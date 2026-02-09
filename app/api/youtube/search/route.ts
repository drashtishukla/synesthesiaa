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

async function searchWithYouTubeApi(query: string) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing YOUTUBE_API_KEY.");
  }

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

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`YouTube search failed: ${message}`);
  }

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

  return (data.items ?? [])
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
