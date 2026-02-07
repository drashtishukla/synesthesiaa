import { NextResponse, type NextRequest } from "next/server";

import { getValidSpotifyTokens, setSpotifyTokenCookies } from "@/lib/spotifyAuth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const tokenResult = await getValidSpotifyTokens(request);
  if (!tokenResult) {
    return NextResponse.json({ error: "Not connected." }, { status: 401 });
  }

  const body = (await request.json()) as { deviceId?: string; play?: boolean };
  if (!body.deviceId) {
    return NextResponse.json(
      { error: "Missing device id." },
      { status: 400 }
    );
  }

  const response = await fetch("https://api.spotify.com/v1/me/player", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${tokenResult.tokens.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      device_ids: [body.deviceId],
      play: body.play ?? true,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json(
      { error: `Spotify transfer failed: ${message}` },
      { status: response.status }
    );
  }

  const outgoing = NextResponse.json({ ok: true });
  if (tokenResult.refreshed) {
    setSpotifyTokenCookies(outgoing, tokenResult.tokens);
  }

  return outgoing;
}
