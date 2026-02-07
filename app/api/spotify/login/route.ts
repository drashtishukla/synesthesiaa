import { NextResponse } from "next/server";

import {
  buildSpotifyAuthorizeUrl,
  setSpotifyOAuthCookies,
} from "@/lib/spotifyAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const room = searchParams.get("room");
  const user = searchParams.get("user");

  if (!room || !user) {
    return NextResponse.json(
      { error: "Missing room or user." },
      { status: 400 }
    );
  }

  try {
    const state = crypto.randomUUID();
    const redirectUrl = buildSpotifyAuthorizeUrl(state);

    const response = NextResponse.redirect(redirectUrl);
    setSpotifyOAuthCookies(response, state, room, user);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
