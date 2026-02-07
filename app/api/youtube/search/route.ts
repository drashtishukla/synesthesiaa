import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json(
      { error: "Missing search query." },
      { status: 400 }
    );
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing YOUTUBE_API_KEY." },
      { status: 500 }
    );
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
    return NextResponse.json(
      { error: `YouTube search failed: ${message}` },
      { status: response.status }
    );
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
      };
    })
    .filter(Boolean);

  return NextResponse.json({ results });
}
