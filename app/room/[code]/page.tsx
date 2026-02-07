"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
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

type YouTubeResult = {
  id: string;
  title: string;
  channel: string;
  thumbnailUrl?: string;
};

function createProviderId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function extractYouTubeId(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace("www.", "");
    if (host === "youtu.be") {
      return url.pathname.replace("/", "");
    }
    if (host.endsWith("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;
      if (url.pathname.startsWith("/embed/")) {
        return url.pathname.split("/embed/")[1] ?? null;
      }
      if (url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/shorts/")[1] ?? null;
      }
    }
  } catch (err) {
    return null;
  }

  return null;
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

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubeArtist, setYoutubeArtist] = useState("");
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [isAddingYoutube, setIsAddingYoutube] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<YouTubeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const voteMap = useMemo(() => {
    const map = new Map<string, number>();
    votes?.forEach((vote) => {
      map.set(vote.songId, vote.value);
    });
    return map;
  }, [votes]);

  const topYouTubeTrack = songs?.find((song) => song.provider === "youtube");

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

  const handleAddYouTube = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!room) {
      setYoutubeError("Room not ready yet.");
      return;
    }
    if (!userId) {
      setYoutubeError("Generating your user id. Try again in a second.");
      return;
    }

    const id = extractYouTubeId(youtubeUrl);
    if (!id) {
      setYoutubeError("Paste a valid YouTube URL or video ID.");
      return;
    }

    const name = youtubeTitle.trim();
    if (!name) {
      setYoutubeError("Add a title for this track.");
      return;
    }

    setYoutubeError(null);
    setIsAddingYoutube(true);
    try {
      await addSong({
        roomId: room._id,
        provider: "youtube",
        providerId: id,
        title: name,
        artist: youtubeArtist.trim() || undefined,
        addedBy: userId,
      });
      setYoutubeUrl("");
      setYoutubeTitle("");
      setYoutubeArtist("");
    } catch (err) {
      setYoutubeError(
        err instanceof Error ? err.message : "Unable to add YouTube track."
      );
    } finally {
      setIsAddingYoutube(false);
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
        `/api/youtube/search?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Search failed.");
      }
      setSearchResults(data.results ?? []);
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : "Unable to search YouTube."
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFromSearch = async (track: YouTubeResult) => {
    if (!room || !userId) {
      setYoutubeError("Room or user not ready yet.");
      return;
    }

    setYoutubeError(null);
    try {
      await addSong({
        roomId: room._id,
        provider: "youtube",
        providerId: track.id,
        title: track.title,
        artist: track.channel,
        albumArtUrl: track.thumbnailUrl,
        addedBy: userId,
      });
    } catch (err) {
      setYoutubeError(
        err instanceof Error ? err.message : "Unable to add YouTube track."
      );
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

        <Card>
          <CardHeader>
            <CardTitle>Playback</CardTitle>
            <CardDescription>
              YouTube embed for the top video in the queue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topYouTubeTrack ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Now playing</p>
                    <p className="text-lg font-semibold">
                      {topYouTubeTrack.title}
                    </p>
                    {topYouTubeTrack.artist ? (
                      <p className="text-sm text-muted-foreground">
                        {topYouTubeTrack.artist}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant="outline">YouTube</Badge>
                </div>
                <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                  <iframe
                    className="h-full w-full"
                    src={`https://www.youtube.com/embed/${topYouTubeTrack.providerId}?rel=0`}
                    title={topYouTubeTrack.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No YouTube tracks yet. Add one to enable playback.
              </p>
            )}
          </CardContent>
        </Card>

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
                        <p className="text-xs text-muted-foreground">
                          {song.provider === "youtube"
                            ? "YouTube"
                            : "Custom"}
                        </p>
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
                Add YouTube links for playback, or a custom track.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <form className="space-y-4" onSubmit={handleSearch}>
                  <div className="space-y-2">
                    <Label htmlFor="youtube-search">Search YouTube</Label>
                    <Input
                      id="youtube-search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search for a track"
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
                            {track.thumbnailUrl ? (
                              <img
                                src={track.thumbnailUrl}
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
                              {track.channel}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddFromSearch(track)}
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

                <form className="space-y-4" onSubmit={handleAddYouTube}>
                  <div className="space-y-2">
                    <Label htmlFor="youtube-url">YouTube URL or ID</Label>
                    <Input
                      id="youtube-url"
                      value={youtubeUrl}
                      onChange={(event) => setYoutubeUrl(event.target.value)}
                      placeholder="https://youtu.be/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="youtube-title">Title</Label>
                    <Input
                      id="youtube-title"
                      value={youtubeTitle}
                      onChange={(event) => setYoutubeTitle(event.target.value)}
                      placeholder="Track title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="youtube-artist">Artist / Channel</Label>
                    <Input
                      id="youtube-artist"
                      value={youtubeArtist}
                      onChange={(event) => setYoutubeArtist(event.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isAddingYoutube || !allowGuestAdd}
                    className="w-full"
                  >
                    {allowGuestAdd
                      ? isAddingYoutube
                        ? "Adding..."
                        : "Add YouTube track"
                      : "Guest add disabled"}
                  </Button>
                  {youtubeError ? (
                    <p className="text-sm text-destructive-foreground">
                      {youtubeError}
                    </p>
                  ) : null}
                </form>

                <div className="h-px w-full bg-white/5" />

                <form className="space-y-4" onSubmit={handleAddSong}>
                  <div className="space-y-2">
                    <Label htmlFor="song-title">Custom title</Label>
                    <Input
                      id="song-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Song title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="song-artist">Custom artist</Label>
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
                        : "Add custom track"
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
      </div>
    </main>
  );
}
