"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState, useEffect, useRef, useCallback } from "react";
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
import { useUserId, useUserName } from "@/app/lib/useUserId";
import YouTube from "react-youtube";
import ReactionOverlay from "@/components/ReactionOverlay";
import NowPlayingProgress from "@/components/NowPlayingProgress";
import ShareRoom from "@/components/ShareRoom";

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
  const router = useRouter();
  const userId = useUserId();
  const [userName, setUserName] = useUserName();
  const room = useQuery(api.rooms.getRoomByCode, { code });
  const songs = useQuery(
    api.songs.listQueue,
    room ? { roomId: room._id } : "skip",
  );
  const votes = useQuery(
    api.votes.listVotesForUser,
    room && userId ? { roomId: room._id, userId } : "skip",
  );


  const addSong = useMutation(api.songs.addSong);
  const removeSong = useMutation(api.songs.removeSong);
  const adminSetScore = useMutation(api.songs.adminSetScore);
  const castVote = useMutation(api.votes.castVote);
  const adminAddVotes = useMutation(api.votes.adminAddVotes);
  const destroyRoom = useMutation(api.rooms.destroyRoom);
  const updateSettings = useMutation(api.rooms.updateSettings);
  const transferHost = useMutation(api.rooms.transferHost);

  const [error, setError] = useState<string | null>(null);

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubeArtist, setYoutubeArtist] = useState("");
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [isAddingYoutube, setIsAddingYoutube] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<YouTubeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Admin-specific state
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
  const [voteInputs, setVoteInputs] = useState<Record<string, string>>({});
  const [confirmDestroy, setConfirmDestroy] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [settingsMaxSongs, setSettingsMaxSongs] = useState<string>("");

<<<<<<< Updated upstream
=======
  // YouTube player ref for progress bar & playback control
  const [ytPlayer, setYtPlayer] = useState<{
    getCurrentTime: () => number;
    getDuration: () => number;
    playVideo: () => void;
    pauseVideo: () => void;
    getPlayerState: () => number;
    setVolume: (v: number) => void;
    getVolume: () => number;
  } | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  // Drag & drop state for queue reorder (host only)
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const reorderSong = useMutation(api.songs.reorderSong);

>>>>>>> Stashed changes
  // Username prompt state
  const [nameInput, setNameInput] = useState("");

  const voteMap = useMemo(() => {
    const map = new Map<string, number>();
    votes?.forEach((vote) => {
      map.set(vote.songId, vote.value);
    });
    return map;
  }, [votes]);

  // Use currentSongId from the room to determine the current song
  const isHost = userId && room && userId === room.hostUserId;
  const currentSong = songs?.find((s) => s._id === room?.currentSongId);
  const advanceSong = useMutation(api.rooms.advanceSong);

  const isAdmin = !!(room && userId && userId === room.hostUserId);

  // Count how many songs the current user has added
  const userSongCount = useMemo(() => {
    if (!songs || !userId) return 0;
    return songs.filter((s) => s.addedBy === userId).length;
  }, [songs, userId]);

  const maxSongsPerUser = room?.settings.maxSongsPerUser ?? 0;
  const atSongLimit =
    !isAdmin && maxSongsPerUser > 0 && userSongCount >= maxSongsPerUser;

  // Get unique contributors for transfer host dropdown
  const contributors = useMemo(() => {
    if (!songs || !userId) return [];
    const map = new Map<string, string>();
    songs.forEach((s) => {
      if (s.addedBy !== userId) {
        map.set(s.addedBy, s.addedByName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [songs, userId]);

  // ── Presence ──────────────────────────────────────────────────────────
  const userCount = useQuery(
    api.presence.list,
    room ? { roomId: room._id } : "skip",
  );
  const heartbeat = useMutation(api.presence.heartbeat);
  const leaveRoom = useMutation(api.presence.leave);

  useEffect(() => {
    if (!room || !userId) return;

    // Initial heartbeat
    heartbeat({ roomId: room._id, userId, userName: userName ?? undefined });

    const interval = setInterval(() => {
      heartbeat({ roomId: room._id, userId, userName: userName ?? undefined });
    }, 5000);

    return () => clearInterval(interval);
  }, [room, userId, userName, heartbeat]);

  const handleLeaveRoom = async () => {
    if (!room || !userId) return;
    try {
      await leaveRoom({ roomId: room._id, userId });
      router.push("/");
    } catch (err) {
      console.error("Failed to leave room", err);
    }
  };

  // ── Username prompt ───────────────────────────────────────────────────
  if (userId && !userName) {
    return (
      <main className="min-h-screen">
        <div className="container flex items-center justify-center py-24">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>What should we call you?</CardTitle>
              <CardDescription>
                Enter a display name so others know who added songs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = nameInput.trim();
                  if (name) setUserName(name);
                }}
              >
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Your name"
                  autoFocus
                />
                <Button type="submit" disabled={!nameInput.trim()}>
                  Continue
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const displayName = userName ?? "Anonymous";

  // ── Handlers ──────────────────────────────────────────────────────────

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
        addedByName: displayName,
      });
      setYoutubeUrl("");
      setYoutubeTitle("");
      setYoutubeArtist("");
    } catch (err) {
      setYoutubeError(
        err instanceof Error ? err.message : "Unable to add YouTube track.",
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
        `/api/youtube/search?q=${encodeURIComponent(query)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Search failed.");
      }
      setSearchResults(data.results ?? []);
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : "Unable to search YouTube.",
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
    if (!allowGuestAdd && !isAdmin) {
      setYoutubeError("Guests cannot add songs in this room.");
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
        addedByName: displayName,
      });
    } catch (err) {
      setYoutubeError(
        err instanceof Error ? err.message : "Unable to add YouTube track.",
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

  const handleRemoveSong = async (songId: Id<"songs">) => {
    if (!userId) return;
    try {
      await removeSong({ songId, userId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove song.");
    }
  };

  const handleAdminSetScore = async (songId: Id<"songs">) => {
    if (!userId) return;
    const val = parseInt(scoreInputs[songId] ?? "", 10);
    if (isNaN(val)) return;
    try {
      await adminSetScore({ songId, userId, score: val });
      setScoreInputs((prev) => ({ ...prev, [songId]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to set score.");
    }
  };

  const handleAdminAddVotes = async (songId: Id<"songs">) => {
    if (!userId) return;
    const val = parseInt(voteInputs[songId] ?? "", 10);
    if (isNaN(val)) return;
    try {
      await adminAddVotes({ songId, userId, delta: val });
      setVoteInputs((prev) => ({ ...prev, [songId]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add votes.");
    }
  };

  const handleDestroyRoom = async () => {
    if (!room || !userId) return;
    try {
      await destroyRoom({ roomId: room._id, userId });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to destroy room.");
    }
  };

  const handleTransferHost = async () => {
    if (!room || !userId || !transferTarget) return;
    try {
      await transferHost({
        roomId: room._id,
        userId,
        newHostUserId: transferTarget,
      });
      setTransferTarget("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to transfer host.");
    }
  };

  const handleUpdateMaxSongs = async () => {
    if (!room || !userId) return;
    const val = parseInt(settingsMaxSongs, 10);
    if (isNaN(val) || val < 0) return;
    try {
      await updateSettings({
        roomId: room._id,
        userId,
        settings: { maxSongsPerUser: val },
      });
      setSettingsMaxSongs("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update settings.",
      );
    }
  };

  // ── Loading / Not found states ────────────────────────────────────────

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
  const canAdd = isAdmin || (allowGuestAdd && !atSongLimit);

  return (
    <main className="min-h-screen pb-6">
      <div className="container flex flex-col gap-4 sm:gap-6 lg:gap-8 py-6 sm:py-8 lg:py-12 px-3 sm:px-6">
        {/* ── Room header ────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-2xl sm:text-3xl lg:text-4xl">
                  {room.name}
                </CardTitle>
                <CardDescription className="mt-2">
                  Room code{" "}
                  <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-sm">
                    {room.code}
                  </span>
                </CardDescription>
                <div className="mt-3">
                  <ShareRoom roomCode={room.code} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">👥 {userCount ?? 1}</Badge>
                <Badge variant="default">Queue {songs?.length ?? 0}</Badge>
                <Badge variant="outline">
                  Downvotes {room.settings.allowDownvotes ? "on" : "off"}
                </Badge>
                {maxSongsPerUser > 0 ? (
                  <Badge variant="outline">Limit {maxSongsPerUser}/user</Badge>
                ) : null}
                {!allowGuestAdd ? (
                  <Badge variant="outline">Guest add off</Badge>
                ) : null}
                {isAdmin ? (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                    ★ Host
                  </Badge>
                ) : null}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleLeaveRoom}
                  className="h-6 text-xs"
                >
                  Leave
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* ── Now Playing ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Now Playing</CardTitle>
          </CardHeader>
          <CardContent>
            {currentSong ? (
              <div className="space-y-3">
                {/* Thumbnail + song info */}
                <div
                  key={currentSong._id}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40"
                >
                  <img
                    src={`https://img.youtube.com/vi/${currentSong.providerId}/hqdefault.jpg`}
                    alt={currentSong.title}
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
                    <p className="text-lg font-semibold text-white drop-shadow">
                      {currentSong.title}
                    </p>
                    <div className="flex flex-wrap gap-2 text-sm text-white/70">
                      {currentSong.artist && <span>{currentSong.artist}</span>}
                      {currentSong.addedByName && (
                        <span className="text-white/50">• Added by {currentSong.addedByName}</span>
                      )}
                    </div>
                  </div>

                  {/* Floating reactions over the thumbnail */}
                  <ReactionOverlay roomId={room._id} userId={userId} />
                </div>

                {/* Audio-only YouTube player – rendered off-screen but visible to browser */}
                <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none" aria-hidden>
                  <YouTube
                    key={currentSong.providerId}
                    videoId={currentSong.providerId}
                    opts={{
                      width: "320",
                      height: "180",
                      playerVars: {
                        autoplay: 1,
                        rel: 0,
                        controls: 0,
                        disablekb: 1,
                        fs: 0,
                        modestbranding: 1,
                        origin: typeof window !== "undefined" ? window.location.origin : "",
                      },
                    }}
                    onReady={(e: any) => {
                      const p = e.target;
                      p.setVolume(100);
                      p.playVideo();
                      setYtPlayer(p);
                      setIsPlaying(true);
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnd={() => {
                      setYtPlayer(null);
                      setIsPlaying(false);
                      if (room) {
                        advanceSong({ roomId: room._id });
                      }
                    }}
                    onError={(e: any) => {
                      console.error("YouTube player error:", e.data);
                    }}
                  />
                </div>

                {/* Playback controls (host only) + progress bar */}
                <div className="flex items-center gap-3">
                  {isHost && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!ytPlayer) return;
                        if (isPlaying) {
                          ytPlayer.pauseVideo();
                        } else {
                          ytPlayer.playVideo();
                        }
                      }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
                      title={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="4" width="4" height="16" rx="1" />
                          <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="6,4 20,12 6,20" />
                        </svg>
                      )}
                    </button>
                  )}
                  <div className="flex-1">
                    <NowPlayingProgress player={ytPlayer} />
                  </div>
                  {isHost && (
                    <button
                      type="button"
                      onClick={() => {
                        if (room) {
                          setYtPlayer(null);
                          advanceSong({ roomId: room._id });
                        }
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
                      title="Skip to next"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="4,4 16,12 4,20" />
                        <rect x="17" y="4" width="3" height="16" rx="1" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add a song to the queue
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Queue + Add song ───────────────────────────────────────── */}
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="order-last lg:order-first">
            <CardHeader>
              <CardTitle>Queue</CardTitle>
              <CardDescription>
                Live ordering based on crowd votes.
                {isAdmin ? " Drag to reorder." : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!songs || songs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No songs yet. Add the first track.
                </p>
              ) : (
                songs.map((song, index) => {
                  const currentVote = voteMap.get(song._id) ?? 0;
                  const canRemove =
                    isAdmin || (userId && song.addedBy === userId);
                  const isCurrent = song._id === room.currentSongId;
                  return (
                    <div
                      key={song._id}
<<<<<<< Updated upstream
                      className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-4 py-3 ${
                        isCurrent
                          ? "border-blue-500 bg-blue-500/10 shadow-lg" // highlight style
                          : "border-white/10 bg-white/5"
=======
                      draggable={isAdmin}
                      onDragStart={() => { if (isAdmin) setDragIdx(index); }}
                      onDragOver={(e) => { if (isAdmin) { e.preventDefault(); setDragOverIdx(index); } }}
                      onDragLeave={() => setDragOverIdx(null)}
                      onDrop={async () => {
                        if (!isAdmin || dragIdx === null || dragIdx === index || !userId) return;
                        try {
                          await reorderSong({ songId: songs[dragIdx]._id, userId, newIndex: index });
                        } catch { /* ignore */ }
                        setDragIdx(null);
                        setDragOverIdx(null);
                      }}
                      onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 sm:px-4 sm:py-3 transition-colors ${
                        dragOverIdx === index
                          ? "border-primary/50 bg-primary/10"
                          : "border-white/10 bg-white/5"
                      } ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""} ${
                        dragIdx === index ? "opacity-50" : ""
>>>>>>> Stashed changes
                      }`}
                    >
                      {/* Drag handle for host */}
                      {isAdmin ? (
                        <span className="text-muted-foreground select-none text-sm hidden sm:inline" title="Drag to reorder">⠿</span>
                      ) : null}
                      <div className="flex-1 min-w-0">
<<<<<<< Updated upstream
                        <p
                          className={`font-semibold ${isCurrent ? "text-blue-300" : ""}`}
                        >
=======
                        <p className="font-semibold text-sm sm:text-base truncate">
>>>>>>> Stashed changes
                          {index + 1}. {song.title}
                        </p>
                        <div className="text-sm text-muted-foreground">
                           {song.artist && <span>{song.artist}</span>}
                           {song.addedByName && (
                             <span className="ml-2 text-xs opacity-70">• Added by {song.addedByName}</span>
                           )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {song.provider === "youtube" ? "YouTube" : "Custom"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
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
                            variant={
                              currentVote === -1 ? "secondary" : "outline"
                            }
                            onClick={() =>
                              handleVote(song._id, currentVote === -1 ? 0 : -1)
                            }
                            disabled={!userId}
                            type="button"
                          >
                            -1
                          </Button>
                        ) : null}
                        <Badge
                          variant="outline"
                          className={
                            song.score > 0
                              ? "border-green-500/40 text-green-400"
                              : song.score < 0
                                ? "border-red-500/40 text-red-400"
                                : ""
                          }
                        >
                          {song.score > 0 ? "+" : ""}
                          {song.score} vote
                          {song.score === 1 || song.score === -1 ? "" : "s"}
                        </Badge>
                        {canRemove ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemoveSong(song._id)}
                            type="button"
                          >
                            ✕
                          </Button>
                        ) : null}
                      </div>

                      {/* Admin inline controls for this song */}
                      {isAdmin ? (
                        <div className="flex w-full flex-wrap items-center gap-2 border-t border-white/5 pt-2 mt-1">
                          <Input
                            className="w-20 h-8 text-xs"
                            placeholder="Score"
                            type="number"
                            value={scoreInputs[song._id] ?? ""}
                            onChange={(e) =>
                              setScoreInputs((prev) => ({
                                ...prev,
                                [song._id]: e.target.value,
                              }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => handleAdminSetScore(song._id)}
                            type="button"
                          >
                            Set
                          </Button>
                          <Input
                            className="w-20 h-8 text-xs"
                            placeholder="+/- votes"
                            type="number"
                            value={voteInputs[song._id] ?? ""}
                            onChange={(e) =>
                              setVoteInputs((prev) => ({
                                ...prev,
                                [song._id]: e.target.value,
                              }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => handleAdminAddVotes(song._id)}
                            type="button"
                          >
                            Add
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {/* ── Song limit indicator ─────────────────────────────── */}
            {maxSongsPerUser > 0 && !isAdmin ? (
              <Card
                className={
                  atSongLimit
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-white/10"
                }
              >
                <CardContent className="py-3 text-sm">
                  You&apos;ve added{" "}
                  <span className="font-semibold">
                    {userSongCount} / {maxSongsPerUser}
                  </span>{" "}
                  songs.
                  {atSongLimit
                    ? " You've reached the limit."
                    : ` (${maxSongsPerUser - userSongCount} remaining)`}
                </CardContent>
              </Card>
            ) : null}

            {/* ── Add a song card ──────────────────────────────────── */}
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
                              disabled={!canAdd || !userId}
                              type="button"
                            >
                              {atSongLimit ? "Limit" : "Add"}
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
                        onChange={(event) =>
                          setYoutubeTitle(event.target.value)
                        }
                        placeholder="Track title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="youtube-artist">Artist / Channel</Label>
                      <Input
                        id="youtube-artist"
                        value={youtubeArtist}
                        onChange={(event) =>
                          setYoutubeArtist(event.target.value)
                        }
                        placeholder="Optional"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isAddingYoutube || !canAdd}
                      className="w-full"
                    >
                      {!canAdd
                        ? atSongLimit
                          ? "Song limit reached"
                          : "Guest add disabled"
                        : isAddingYoutube
                          ? "Adding..."
                          : "Add YouTube track"}
                    </Button>
                    {youtubeError ? (
                      <p className="text-sm text-destructive-foreground">
                        {youtubeError}
                      </p>
                    ) : null}
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── Admin Panel ────────────────────────────────────────────── */}
        {isAdmin ? (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>★</span> Host Controls
              </CardTitle>
              <CardDescription>
                Manage room settings, transfer host, or destroy the room.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Settings */}
              <div className="space-y-3">
                <p className="text-sm font-semibold">Room Settings</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Max songs per user</Label>
                    <Input
                      className="w-24 h-8 text-xs"
                      type="number"
                      min={0}
                      placeholder={String(maxSongsPerUser)}
                      value={settingsMaxSongs}
                      onChange={(e) => setSettingsMaxSongs(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleUpdateMaxSongs}
                    type="button"
                  >
                    Update
                  </Button>
                </div>
              </div>

              <div className="h-px w-full bg-white/5" />

              {/* Transfer Host */}
              <div className="space-y-3">
                <p className="text-sm font-semibold">Transfer Host</p>
                {contributors.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No other contributors yet. Others must add a song first.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">New host</Label>
                      <select
                        className="h-8 rounded-md border border-white/10 bg-background px-2 text-xs"
                        value={transferTarget}
                        onChange={(e) => setTransferTarget(e.target.value)}
                      >
                        <option value="">Select a user</option>
                        {contributors.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.id.slice(0, 8)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleTransferHost}
                      disabled={!transferTarget}
                      type="button"
                    >
                      Transfer
                    </Button>
                  </div>
                )}
              </div>

              <div className="h-px w-full bg-white/5" />

              {/* Destroy Room */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-destructive">
                  Danger Zone
                </p>
                {confirmDestroy ? (
                  <div className="flex items-center gap-3">
                    <p className="text-sm">
                      Are you sure? This deletes everything.
                    </p>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleDestroyRoom}
                      type="button"
                    >
                      Yes, destroy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmDestroy(false)}
                      type="button"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setConfirmDestroy(true)}
                    type="button"
                  >
                    Destroy Room
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {error ? (
          <Card className="border-destructive/40 bg-destructive/10">
            <CardContent className="py-4 text-sm text-destructive-foreground">
              {error}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* ── Sticky mobile now-playing bar ─────────────────────────── */}
      {currentSong ? (
        <div className="fixed bottom-0 inset-x-0 z-50 block lg:hidden border-t border-white/10 bg-card/95 backdrop-blur px-4 py-2.5 safe-bottom">
          <div className="flex items-center gap-3">
            <img
              src={`https://img.youtube.com/vi/${currentSong.providerId}/default.jpg`}
              alt=""
              className="h-10 w-10 rounded-lg object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{currentSong.title}</p>
              {currentSong.artist ? (
                <p className="text-xs text-muted-foreground truncate">{currentSong.artist}</p>
              ) : null}
            </div>
            {isHost ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs shrink-0"
                onClick={() => advanceSong({ roomId: room._id })}
                type="button"
              >
                Skip ⏭
              </Button>
            ) : null}
          </div>
          <div className="mt-1">
            <NowPlayingProgress player={ytPlayer} />
          </div>
        </div>
      ) : null}
    </main>
  );
}
