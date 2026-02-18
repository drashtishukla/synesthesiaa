import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

type YouTubeResult = {
  id: string;
  title: string;
  channel: string;
  thumbnailUrl?: string;
};

/* ─── API-key rotation state (persists for the lifetime of the process) ─── */

/** Parse comma-separated API keys from env. */
function getApiKeys(): string[] {
  return (process.env.YOUTUBE_API_KEY ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

/** Round-robin index – spreads load evenly across keys. */
let keyIndex = 0;

/**
 * Track exhausted keys so we don't waste time retrying them.
 * Maps key index → timestamp when it was marked exhausted.
 * Automatically expires after COOLDOWN_MS (keys reset at midnight PT,
 * but we use a shorter window so we can re-check periodically).
 */
const exhaustedKeys = new Map<number, number>();
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

function isKeyExhausted(idx: number): boolean {
  const ts = exhaustedKeys.get(idx);
  if (ts === undefined) return false;
  if (Date.now() - ts > COOLDOWN_MS) {
    exhaustedKeys.delete(idx);
    return false;
  }
  return true;
}

/* ─── In-memory search cache ─── */

interface CacheEntry {
  results: (YouTubeResult | null)[];
  ts: number;
}

const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 200;

function getCached(query: string): (YouTubeResult | null)[] | null {
  const entry = searchCache.get(query.toLowerCase());
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    searchCache.delete(query.toLowerCase());
    return null;
  }
  return entry.results;
}

function setCache(query: string, results: (YouTubeResult | null)[]) {
  // Evict oldest entries if cache is full.
  if (searchCache.size >= MAX_CACHE_SIZE) {
    const oldest = searchCache.keys().next().value;
    if (oldest !== undefined) searchCache.delete(oldest);
  }
  searchCache.set(query.toLowerCase(), { results, ts: Date.now() });
}

/* ─── YouTube Data API search with key rotation ─── */

async function searchWithYouTubeApi(query: string) {
  // 1. Check cache first – avoids burning quota entirely.
  const cached = getCached(query);
  if (cached) return cached;

  const keys = getApiKeys();
  if (keys.length === 0) {
    throw new Error("Missing YOUTUBE_API_KEY.");
  }

  const errors: string[] = [];

  // 2. Try every key, starting from the current round-robin index.
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (keyIndex + attempt) % keys.length;

    // Skip keys we already know are exhausted.
    if (isKeyExhausted(idx)) {
      errors.push(`Key #${idx + 1} is cooling down (quota exhausted).`);
      continue;
    }

    const apiKey = keys[idx];

    const params = new URLSearchParams({
      key: apiKey,
      part: "snippet",
      q: query,
      type: "video",
      maxResults: "8",
      videoEmbeddable: "true",
      safeSearch: "moderate",
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
      { cache: "no-store" }
    );

    if (response.ok) {
      // Advance index so the next request starts with the next key.
      keyIndex = (idx + 1) % keys.length;

      const data = (await response.json()) as {
        items: Array<{
          id: { videoId?: string };
          snippet: {
            title: string;
            channelTitle: string;
            thumbnails?: {
              medium?: { url: string };
              high?: { url: string };
              default?: { url: string };
            };
          };
        }>;
      };

      const results = (data.items ?? [])
        .map((item) => {
          const id = item.id?.videoId;
          if (!id) return null;
          const thumb =
            item.snippet.thumbnails?.medium?.url ||
            item.snippet.thumbnails?.high?.url ||
            item.snippet.thumbnails?.default?.url;
          return {
            id,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumbnailUrl: thumb,
          } satisfies YouTubeResult;
        })
        .filter(Boolean);

      setCache(query, results);
      return results;
    }

    // 403 / 429 → quota or rate-limit hit. Mark key exhausted & try next.
    if (response.status === 403 || response.status === 429) {
      exhaustedKeys.set(idx, Date.now());
      const body = await response.text();
      errors.push(`Key #${idx + 1} quota/rate-limited: ${body}`);
      continue;
    }

    // Any other error (400 invalid key, 500, etc.) → skip this key, try next.
    const message = await response.text();
    errors.push(
      `Key #${idx + 1} failed (HTTP ${response.status}): ${message}`
    );
    continue;
  }

  // All keys exhausted – advance index anyway for next time.
  keyIndex = (keyIndex + 1) % keys.length;
  throw new Error(
    `All ${keys.length} YouTube API key(s) are rate-limited. ${errors.join(" | ")}`
  );
}

async function searchWithYtMusic(query: string) {
  const headersPath = process.env.YTMUSIC_HEADERS_PATH;
  if (!headersPath) {
    throw new Error("Missing YTMUSIC_HEADERS_PATH.");
  }

  const pythonBin = process.env.YTMUSIC_PYTHON || "python";
  const scriptPath = path.join(process.cwd(), "scripts", "ytmusic_search.py");

  const { stdout } = await execFileAsync(
    pythonBin,
    [scriptPath, query, headersPath],
    {
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    }
  );

  const payload = JSON.parse(stdout) as { results?: YouTubeResult[] };
  if (!Array.isArray(payload.results)) {
    throw new Error("Invalid response from YT Music fallback.");
  }

  return payload.results;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json(
      { error: "Missing search query." },
      { status: 400 }
    );
  }

  const errors: string[] = [];

  if (process.env.YOUTUBE_API_KEY) {
    try {
      const results = await searchWithYouTubeApi(query);
      return NextResponse.json({ results, source: "youtube" });
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "YouTube search failed.");
    }
  } else {
    errors.push("Missing YOUTUBE_API_KEY.");
  }

  if (process.env.YTMUSIC_HEADERS_PATH) {
    try {
      const results = await searchWithYtMusic(query);
      return NextResponse.json({ results, source: "ytmusic" });
    } catch (err) {
      errors.push(
        err instanceof Error ? err.message : "YT Music fallback failed."
      );
    }
  } else {
    errors.push("Missing YTMUSIC_HEADERS_PATH.");
  }

  return NextResponse.json({ error: errors.join(" | ") }, { status: 500 });
}
