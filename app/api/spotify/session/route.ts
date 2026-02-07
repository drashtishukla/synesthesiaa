import { NextResponse, type NextRequest } from "next/server";

import { getValidSpotifyTokens, setSpotifyTokenCookies } from "@/lib/spotifyAuth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const tokenResult = await getValidSpotifyTokens(request);
  if (!tokenResult) {
    return NextResponse.json({ connected: false });
  }

  const response = NextResponse.json({
    connected: true,
    expiresAt: tokenResult.tokens.expiresAt,
  });

  if (tokenResult.refreshed) {
    setSpotifyTokenCookies(response, tokenResult.tokens);
  }

  return response;
}
