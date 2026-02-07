import { NextResponse, type NextRequest } from "next/server";

import { getValidSpotifyTokens, setSpotifyTokenCookies } from "@/lib/spotifyAuth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const tokenResult = await getValidSpotifyTokens(request);
  if (!tokenResult) {
    return NextResponse.json({ error: "Not connected." }, { status: 401 });
  }

  const response = await fetch("https://api.spotify.com/v1/me/player/next", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenResult.tokens.accessToken}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json(
      { error: `Spotify next failed: ${message}` },
      { status: response.status }
    );
  }

  const outgoing = NextResponse.json({ ok: true });
  if (tokenResult.refreshed) {
    setSpotifyTokenCookies(outgoing, tokenResult.tokens);
  }

  return outgoing;
}
