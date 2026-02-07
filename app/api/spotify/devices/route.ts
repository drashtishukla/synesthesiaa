import { NextResponse, type NextRequest } from "next/server";

import { getValidSpotifyTokens, setSpotifyTokenCookies } from "@/lib/spotifyAuth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const tokenResult = await getValidSpotifyTokens(request);
  if (!tokenResult) {
    return NextResponse.json({ error: "Not connected." }, { status: 401 });
  }

  const response = await fetch("https://api.spotify.com/v1/me/player/devices", {
    headers: {
      Authorization: `Bearer ${tokenResult.tokens.accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json(
      { error: `Spotify devices failed: ${message}` },
      { status: response.status }
    );
  }

  const data = await response.json();
  const outgoing = NextResponse.json({ devices: data.devices ?? [] });

  if (tokenResult.refreshed) {
    setSpotifyTokenCookies(outgoing, tokenResult.tokens);
  }

  return outgoing;
}
