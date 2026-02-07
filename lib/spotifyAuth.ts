import type { NextRequest, NextResponse } from "next/server";

const COOKIE_ACCESS = "spotify_access_token";
const COOKIE_REFRESH = "spotify_refresh_token";
const COOKIE_EXPIRES = "spotify_expires_at";
const COOKIE_STATE = "spotify_oauth_state";
const COOKIE_ROOM = "spotify_oauth_room";
const COOKIE_USER = "spotify_oauth_user";

const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-read-email",
  "user-read-private",
];

export type SpotifyTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

function getSpotifyCredentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Spotify credentials or redirect URI.");
  }

  return { clientId, clientSecret, redirectUri };
}

function getCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function buildSpotifyAuthorizeUrl(state: string) {
  const { clientId, redirectUri } = getSpotifyCredentials();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SCOPES.join(" "),
    redirect_uri: redirectUri,
    state,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const { clientId, clientSecret, redirectUri } = getSpotifyCredentials();
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Spotify auth failed: ${message}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 60_000,
  } satisfies SpotifyTokens;
}

export async function refreshSpotifyTokens(refreshToken: string) {
  const { clientId, clientSecret } = getSpotifyCredentials();
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Spotify refresh failed: ${message}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000 - 60_000,
  } satisfies SpotifyTokens;
}

export function readSpotifyTokens(request: NextRequest): SpotifyTokens | null {
  const accessToken = request.cookies.get(COOKIE_ACCESS)?.value;
  const refreshToken = request.cookies.get(COOKIE_REFRESH)?.value;
  const expiresAtRaw = request.cookies.get(COOKIE_EXPIRES)?.value;

  if (!accessToken || !refreshToken || !expiresAtRaw) {
    return null;
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt)) {
    return null;
  }

  return { accessToken, refreshToken, expiresAt };
}

export async function getValidSpotifyTokens(request: NextRequest) {
  const tokens = readSpotifyTokens(request);
  if (!tokens) {
    return null;
  }

  if (tokens.expiresAt > Date.now()) {
    return { tokens, refreshed: false };
  }

  const refreshed = await refreshSpotifyTokens(tokens.refreshToken);
  return { tokens: refreshed, refreshed: true };
}

export function setSpotifyTokenCookies(
  response: NextResponse,
  tokens: SpotifyTokens
) {
  const accessMaxAge = Math.max(
    60,
    Math.floor((tokens.expiresAt - Date.now()) / 1000)
  );
  response.cookies.set(COOKIE_ACCESS, tokens.accessToken, {
    ...getCookieOptions(accessMaxAge),
  });
  response.cookies.set(COOKIE_REFRESH, tokens.refreshToken, {
    ...getCookieOptions(60 * 60 * 24 * 30),
  });
  response.cookies.set(COOKIE_EXPIRES, String(tokens.expiresAt), {
    ...getCookieOptions(60 * 60 * 24 * 30),
  });
}

export function setSpotifyOAuthCookies(
  response: NextResponse,
  state: string,
  room: string,
  userId: string
) {
  const options = getCookieOptions(60 * 10);
  response.cookies.set(COOKIE_STATE, state, options);
  response.cookies.set(COOKIE_ROOM, room, options);
  response.cookies.set(COOKIE_USER, userId, options);
}

export function readSpotifyOAuthCookies(request: NextRequest) {
  const state = request.cookies.get(COOKIE_STATE)?.value;
  const room = request.cookies.get(COOKIE_ROOM)?.value;
  const userId = request.cookies.get(COOKIE_USER)?.value;

  if (!state || !room || !userId) {
    return null;
  }

  return { state, room, userId };
}

export function clearSpotifyOAuthCookies(response: NextResponse) {
  response.cookies.delete(COOKIE_STATE);
  response.cookies.delete(COOKIE_ROOM);
  response.cookies.delete(COOKIE_USER);
}
