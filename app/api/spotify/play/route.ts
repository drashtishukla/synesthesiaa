import { NextResponse, type NextRequest } from "next/server";

import { getValidSpotifyTokens, setSpotifyTokenCookies } from "@/lib/spotifyAuth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const tokenResult = await getValidSpotifyTokens(request);
  if (!tokenResult) {
    return NextResponse.json({ error: "Not connected." }, { status: 401 });
  }

  const body = (await request.json()) as { deviceId?: string; uri?: string };
  const url = new URL("https://api.spotify.com/v1/me/player/play");
  if (body.deviceId) {
    url.searchParams.set("device_id", body.deviceId);
  }

  const payload = body.uri ? { uris: [body.uri] } : {};
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${tokenResult.tokens.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json(
      { error: `Spotify play failed: ${message}` },
      { status: response.status }
    );
  }

  const outgoing = NextResponse.json({ ok: true });
  if (tokenResult.refreshed) {
    setSpotifyTokenCookies(outgoing, tokenResult.tokens);
  }

  return outgoing;
}
