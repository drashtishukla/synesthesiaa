import { NextResponse, type NextRequest } from "next/server";

import {
  clearSpotifyOAuthCookies,
  exchangeCodeForTokens,
  readSpotifyOAuthCookies,
  setSpotifyTokenCookies,
} from "@/lib/spotifyAuth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const stored = readSpotifyOAuthCookies(request);

  if (error) {
    const target = stored?.room ? `/room/${stored.room}?spotify=error` : `/`;
    const response = NextResponse.redirect(new URL(target, request.url));
    clearSpotifyOAuthCookies(response);
    return response;
  }

  if (!code || !state || !stored || stored.state !== state) {
    return NextResponse.json(
      { error: "Invalid OAuth state." },
      { status: 400 }
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const response = NextResponse.redirect(
      new URL(`/room/${stored.room}?spotify=connected`, request.url)
    );
    setSpotifyTokenCookies(response, tokens);
    clearSpotifyOAuthCookies(response);
    return response;
  } catch (err) {
    const response = NextResponse.redirect(
      new URL(`/room/${stored.room}?spotify=error`, request.url)
    );
    clearSpotifyOAuthCookies(response);
    return response;
  }
}
