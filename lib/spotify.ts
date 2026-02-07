type SpotifyToken = {
  accessToken: string;
  expiresAt: number;
};

let cachedToken: SpotifyToken | null = null;

function getSpotifyCredentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Spotify credentials.");
  }

  return { clientId, clientSecret };
}

async function fetchSpotifyToken(): Promise<SpotifyToken> {
  const { clientId, clientSecret } = getSpotifyCredentials();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Spotify auth failed: ${message}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 60_000,
  };
}

export async function getSpotifyAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  cachedToken = await fetchSpotifyToken();
  return cachedToken.accessToken;
}

export type SpotifyTrackResult = {
  id: string;
  title: string;
  artist: string;
  albumArtUrl?: string;
  durationMs: number;
};

export async function searchSpotifyTracks(query: string, limit = 8) {
  const accessToken = await getSpotifyAccessToken();
  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: String(limit),
  });

  const response = await fetch(
    `https://api.spotify.com/v1/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Spotify search failed: ${message}`);
  }

  const data = (await response.json()) as {
    tracks: {
      items: Array<{
        id: string;
        name: string;
        duration_ms: number;
        artists: Array<{ name: string }>;
        album: {
          images: Array<{ url: string }>;
        };
      }>;
    };
  };

  return data.tracks.items.map((track) => ({
    id: track.id,
    title: track.name,
    artist: track.artists.map((artist) => artist.name).join(", "),
    albumArtUrl: track.album.images[0]?.url,
    durationMs: track.duration_ms,
  }));
}
