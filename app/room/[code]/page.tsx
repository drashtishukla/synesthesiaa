"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUserId } from "@/app/lib/useUserId";

type RoomPageProps = {
  params: { code: string };
};

type SpotifyResult = {
  id: string;
  title: string;
  artist: string;
  albumArtUrl?: string;
  durationMs: number;
};

type SpotifyDevice = {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent?: number;
  is_restricted?: boolean;
};

function createProviderId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function RoomPage({ params }: RoomPageProps) {
  const code = params.code.toUpperCase();
  const userId = useUserId();
  const room = useQuery(api.rooms.getRoomByCode, { code });
  const songs = useQuery(
    api.songs.listQueue,
    room ? { roomId: room._id } : "skip"
  );
  const votes = useQuery(
    api.votes.listVotesForUser,
    room && userId ? { roomId: room._id, userId } : "skip"
  );

  const addSong = useMutation(api.songs.addSong);
  const castVote = useMutation(api.votes.castVote);

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [spotifyBusy, setSpotifyBusy] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);

  const voteMap = useMemo(() => {
    const map = new Map<string, number>();
    votes?.forEach((vote) => {
      map.set(vote.songId, vote.value);
    });
    return map;
  }, [votes]);

  const isHost = Boolean(userId && room?.hostUserId === userId);
  const topSpotifyTrack = songs?.find((song) => song.provider === "spotify");

  const handleAddSong = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!room) {
      setError("Room not ready yet.");
      return;
    }
    if (!userId) {
      setError("Generating your user id. Try again in a second.");
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Song title is required.");
      return;
    }

    setError(null);
    setIsAdding(true);
    try {
      await addSong({
        roomId: room._id,
        provider: "custom",
        providerId: createProviderId(),
        title: trimmedTitle,
        artist: artist.trim() || undefined,
        addedBy: userId,
      });
      setTitle("");
      setArtist("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add song.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchError("Enter a search term.");
      return;
    }

    setSearchError(null);
    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/spotify/search?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Search failed.");
      }
      setSearchResults(data.results ?? []);
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : "Unable to search Spotify."
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSpotify = async (track: SpotifyResult) => {
    if (!room || !userId) {
      setError("Room or user not ready yet.");
      return;
    }
    if (!allowGuestAdd && userId !== room.hostUserId) {
      setError("Guests cannot add songs in this room.");
      return;
    }

    setError(null);
    try {
      await addSong({
        roomId: room._id,
        provider: "spotify",
        providerId: track.id,
        title: track.title,
        artist: track.artist,
        albumArtUrl: track.albumArtUrl,
        durationMs: track.durationMs,
        addedBy: userId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add song.");
    }
  };

  useEffect(() => {
    if (!isHost) {
      return;
    }

    let cancelled = false;
    const loadSession = async () => {
      try {
        const response = await fetch("/api/spotify/session");
        const data = await response.json();
        if (!cancelled) {
          setSpotifyConnected(Boolean(data.connected));
        }
      } catch (err) {
        if (!cancelled) {
          setSpotifyConnected(false);
        }
      }
    };

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [isHost]);

  const refreshDevices = async () => {
    setSpotifyError(null);
    setSpotifyBusy(true);
    try {
      const response = await fetch("/api/spotify/devices");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to load devices.");
      }
      const list: SpotifyDevice[] = data.devices ?? [];
      setDevices(list);
      const active = list.find((device) => device.is_active);
      setDeviceId((prev) => prev || active?.id || list[0]?.id || "");
    } catch (err) {
      setSpotifyError(
        err instanceof Error ? err.message : "Unable to load devices."
      );
    } finally {
      setSpotifyBusy(false);
    }
  };

  useEffect(() => {
    if (spotifyConnected) {
      void refreshDevices();
    }
  }, [spotifyConnected]);

  const handleTransfer = async () => {
    if (!deviceId) {
      setSpotifyError("Select a device first.");
      return;
    }
    setSpotifyError(null);
    setSpotifyBusy(true);
    try {
      const response = await fetch("/api/spotify/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, play: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Transfer failed.");
      }
    } catch (err) {
      setSpotifyError(
        err instanceof Error ? err.message : "Transfer failed."
      );
    } finally {
      setSpotifyBusy(false);
    }
  };

  const handlePlayTop = async () => {
    if (!topSpotifyTrack) {
      setSpotifyError("No Spotify tracks in the queue yet.");
      return;
    }
    setSpotifyError(null);
    setSpotifyBusy(true);
    try {
      const response = await fetch("/api/spotify/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: deviceId || undefined,
          uri: `spotify:track:${topSpotifyTrack.providerId}`,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Play failed.");
      }
    } catch (err) {
      setSpotifyError(err instanceof Error ? err.message : "Play failed.");
    } finally {
      setSpotifyBusy(false);
    }
  };

  const handlePause = async () => {
    setSpotifyError(null);
    setSpotifyBusy(true);
    try {
      const response = await fetch("/api/spotify/pause", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Pause failed.");
      }
    } catch (err) {
      setSpotifyError(err instanceof Error ? err.message : "Pause failed.");
    } finally {
      setSpotifyBusy(false);
    }
  };

  const handleNext = async () => {
    setSpotifyError(null);
    setSpotifyBusy(true);
    try {
      const response = await fetch("/api/spotify/next", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Next failed.");
      }
    } catch (err) {
      setSpotifyError(err instanceof Error ? err.message : "Next failed.");
    } finally {
      setSpotifyBusy(false);
    }
  };

  const handleVote = async (songId: Id<"songs">, nextValue: number) => {
    if (!room || !userId) {
      setError("Room or user not ready yet.");
      return;
    }
    setError(null);
    try {
      await castVote({
        roomId: room._id,
        songId,
        userId,
        value: nextValue,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cast vote.");
    }
  };

  if (room === undefined) {
    return (
      <main className="min-h-screen">
        <div className="container py-16">
          <Card>
            <CardContent className="py-6">Loading room...</CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (room === null) {
    return (
      <main className="min-h-screen">
        <div className="container py-16">
          <Card className="border-destructive/40 bg-destructive/10">
            <CardHeader>
              <CardTitle>Room not found</CardTitle>
              <CardDescription>
                Double-check the room code and try again.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/">Back home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const allowGuestAdd = room.settings.allowGuestAdd;
  const connectUrl = userId
    ? `/api/spotify/login?room=${room.code}&user=${userId}`
    : "#";

  return (
    <main className="min-h-screen">
      <div className="container flex flex-col gap-8 py-12">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-3xl sm:text-4xl">
                  {room.name}
                </CardTitle>
                <CardDescription className="mt-2">
                  Room code{" "}
                  <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-sm">
                    {room.code}
                  </span>
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">Queue {songs?.length ?? 0}</Badge>
                <Badge variant="outline">
                  Downvotes {room.settings.allowDownvotes ? "on" : "off"}
                </Badge>
                {!allowGuestAdd ? (
                  <Badge variant="outline">Guest add off</Badge>
                ) : null}
              </div>
            </div>
          </CardHeader>
        </Card>

        {isHost ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Host playback</CardTitle>
                  <CardDescription>
                    Connect Spotify and control playback from this room.
                  </CardDescription>
                </div>
                <Badge variant="outline">
                  {spotifyConnected === null
                    ? "Checking..."
                    : spotifyConnected
                      ? "Connected"
                      : "Not connected"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!spotifyConnected ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Button asChild>
                    <Link href={connectUrl}>Connect Spotify</Link>
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Requires a Spotify Premium account to control playback.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="device-select">Playback device</Label>
                      <select
                        id="device-select"
                        className="h-11 w-full rounded-xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                        value={deviceId}
                        onChange={(event) => setDeviceId(event.target.value)}
                      >
                        <option value="">Select a device</option>
                        {devices.map((device) => (
                          <option key={device.id} value={device.id}>
                            {device.name} {device.is_active ? "(active)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      variant="outline"
                      onClick={refreshDevices}
                      disabled={spotifyBusy}
                      type="button"
                    >
                      Refresh devices
                    </Button>
                    <Button
                      onClick={handleTransfer}
                      disabled={spotifyBusy || !deviceId}
                      type="button"
                    >
                      Transfer
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      onClick={handlePlayTop}
                      disabled={spotifyBusy || !topSpotifyTrack}
                      type="button"
                    >
                      Play top queue track
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handlePause}
                      disabled={spotifyBusy}
                      type="button"
                    >
                      Pause
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleNext}
                      disabled={spotifyBusy}
                      type="button"
                    >
                      Next
                    </Button>
                    {topSpotifyTrack ? (
                      <span className="text-sm text-muted-foreground">
                        Next up: {topSpotifyTrack.title}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Add a Spotify track to enable play.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {spotifyError ? (
                <p className="text-sm text-destructive-foreground">
                  {spotifyError}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="order-last lg:order-first">
            <CardHeader>
              <CardTitle>Queue</CardTitle>
              <CardDescription>
                Live ordering based on crowd votes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!songs || songs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No songs yet. Add the first track.
                </p>
              ) : (
                songs.map((song, index) => {
                  const currentVote = voteMap.get(song._id) ?? 0;
                  return (
                    <div
                      key={song._id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <div>
                        <p className="font-semibold">
                          {index + 1}. {song.title}
                        </p>
                        {song.artist ? (
                          <p className="text-sm text-muted-foreground">
                            {song.artist}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={currentVote === 1 ? "default" : "outline"}
                          onClick={() =>
                            handleVote(song._id, currentVote === 1 ? 0 : 1)
                          }
                          disabled={!userId}
                          type="button"
                        >
                          +1
                        </Button>
                        {room.settings.allowDownvotes ? (
                          <Button
                            size="sm"
                            variant={currentVote === -1 ? "secondary" : "outline"}
                            onClick={() =>
                              handleVote(song._id, currentVote === -1 ? 0 : -1)
                            }
                            disabled={!userId}
                            type="button"
                          >
                            -1
                          </Button>
                        ) : null}
                        <Badge variant="outline">{song.score}</Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add a song</CardTitle>
              <CardDescription>
                Search Spotify or add a custom track.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <form className="space-y-4" onSubmit={handleSearch}>
                  <div className="space-y-2">
                    <Label htmlFor="spotify-search">Search Spotify</Label>
                    <Input
                      id="spotify-search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search tracks or artists"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={isSearching}
                  >
                    {isSearching ? "Searching..." : "Search"}
                  </Button>
                  {searchError ? (
                    <p className="text-sm text-destructive-foreground">
                      {searchError}
                    </p>
                  ) : null}
                  {searchResults.length > 0 ? (
                    <div className="space-y-3">
                      {searchResults.map((track) => (
                        <div
                          key={track.id}
                          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                        >
                          <div className="h-10 w-10 overflow-hidden rounded-lg bg-black/30">
                            {track.albumArtUrl ? (
                              <img
                                src={track.albumArtUrl}
                                alt={track.title}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold">
                              {track.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {track.artist}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddSpotify(track)}
                            disabled={!allowGuestAdd || !userId}
                            type="button"
                          >
                            Add
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </form>

                <div className="h-px w-full bg-white/5" />

                <form className="space-y-4" onSubmit={handleAddSong}>
                  <div className="space-y-2">
                    <Label htmlFor="song-title">Manual title</Label>
                    <Input
                      id="song-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Song title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="song-artist">Manual artist</Label>
                    <Input
                      id="song-artist"
                      value={artist}
                      onChange={(event) => setArtist(event.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isAdding || !allowGuestAdd}
                    className="w-full"
                  >
                    {allowGuestAdd
                      ? isAdding
                        ? "Adding..."
                        : "Add manually"
                      : "Guest add disabled"}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </section>

        {error ? (
          <Card className="border-destructive/40 bg-destructive/10">
            <CardContent className="py-4 text-sm text-destructive-foreground">
              {error}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Playback</CardTitle>
            <CardDescription>
              Synesthesia decides the next track, not how it streams.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Use Spotify Connect, YouTube, or another provider on the host device
            to play the queue in real time.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
