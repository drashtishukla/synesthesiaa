"use client";

import { type FormEvent, useMemo, useState, useEffect } from "react";
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

/* ─── helpers ──────────────────────────────────────────────────────────── */

type YouTubeResult = {
  id: string;
  title: string;
  channel: string;
  thumbnailUrl?: string;
};

function extractYouTubeId(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace("www.", "");
    if (host === "youtu.be") return url.pathname.replace("/", "");
    if (host.endsWith("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;
      if (url.pathname.startsWith("/embed/"))
        return url.pathname.split("/embed/")[1] ?? null;
      if (url.pathname.startsWith("/shorts/"))
        return url.pathname.split("/shorts/")[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

type WidgetView = "lobby" | "room";

/* ═══════════════════════════════════════════════════════════════════════ */

export default function EmbedPage() {
  const userId = useUserId();
  const [userName, setUserName] = useUserName();

  // Navigation state (no router — single-page widget)
  const [view, setView] = useState<WidgetView>("lobby");
  const [roomCode, setRoomCode] = useState<string | null>(null);

  if (userId && !userName) {
    return <UsernamePrompt onSubmit={setUserName} />;
  }

  if (view === "room" && roomCode) {
    return (
      <EmbedRoom
        code={roomCode}
        userId={userId}
        userName={userName ?? "Anonymous"}
        onLeave={() => {
          setRoomCode(null);
          setView("lobby");
        }}
      />
    );
  }

  return (
    <EmbedLobby
      userId={userId}
      onJoin={(code) => {
        setRoomCode(code);
        setView("room");
      }}
    />
  );
}

/* ─── Username Prompt ──────────────────────────────────────────────────── */

function UsernamePrompt({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [input, setInput] = useState("");
  return (
    <div className="flex items-center justify-center p-4 min-h-[300px]">
      <Card className="w-full max-w-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">What's your name?</CardTitle>
          <CardDescription className="text-xs">
            So others know who added songs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const name = input.trim();
              if (name) onSubmit(name);
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Your name"
              className="h-8 text-sm"
              autoFocus
            />
            <Button type="submit" disabled={!input.trim()} size="sm" className="w-full">
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Lobby ────────────────────────────────────────────────────────────── */

function EmbedLobby({
  userId,
  onJoin,
}: {
  userId: string | null;
  onJoin: (code: string) => void;
}) {
  const createRoom = useMutation(api.rooms.createRoom);
  const [roomName, setRoomName] = useState("");
  const [maxSongsPerUser, setMaxSongsPerUser] = useState(5);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userId) {
      setError("Generating user id. Try again.");
      return;
    }
    setError(null);
    setIsCreating(true);
    try {
      const name = roomName.trim() || "Untitled Room";
      const result = await createRoom({ name, hostUserId: userId, maxSongsPerUser });
      onJoin(result.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create room.");
      setIsCreating(false);
    }
  };

  const handleJoin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError("Enter a room code.");
      return;
    }
    setError(null);
    onJoin(code);
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Brand */}
      <div className="text-center space-y-1">
        <h1 className="text-xl font-display font-semibold text-glow">Synesthesia</h1>
        <p className="text-xs text-muted-foreground">
          Real-time crowd-controlled music queue
        </p>
      </div>

      {/* Create */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm">Start a room</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <form className="space-y-2" onSubmit={handleCreate}>
            <Input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Room name"
              className="h-8 text-xs"
            />
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Songs/user</Label>
              <Input
                type="number"
                min={0}
                value={maxSongsPerUser}
                onChange={(e) => setMaxSongsPerUser(Number(e.target.value))}
                className="h-8 text-xs w-16"
              />
              <Button type="submit" size="sm" disabled={isCreating} className="ml-auto text-xs h-7">
                {isCreating ? "..." : "Create"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Join */}
      <Card className="border-secondary/20 bg-secondary/5">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm">Join a room</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <form className="flex items-center gap-2" onSubmit={handleJoin}>
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Room code"
              className="h-8 text-xs"
            />
            <Button type="submit" variant="outline" size="sm" className="text-xs h-7 whitespace-nowrap">
              Join
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}
    </div>
  );
}

/* ─── Room (compact) ───────────────────────────────────────────────────── */

function EmbedRoom({
  code,
  userId,
  userName,
  onLeave,
}: {
  code: string;
  userId: string | null;
  userName: string;
  onLeave: () => void;
}) {
  const room = useQuery(api.rooms.getRoomByCode, { code: code.toUpperCase() });
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
  const castVote = useMutation(api.votes.castVote);
  const advanceSong = useMutation(api.rooms.advanceSong);
  const destroyRoom = useMutation(api.rooms.destroyRoom);
  const updateSettings = useMutation(api.rooms.updateSettings);
  const transferHost = useMutation(api.rooms.transferHost);
  const adminSetScore = useMutation(api.songs.adminSetScore);
  const adminAddVotes = useMutation(api.votes.adminAddVotes);

  // Presence
  const userCount = useQuery(api.presence.list, room ? { roomId: room._id } : "skip");
  const heartbeatMut = useMutation(api.presence.heartbeat);
  const leaveRoomMut = useMutation(api.presence.leave);

  useEffect(() => {
    if (!room || !userId) return;
    heartbeatMut({ roomId: room._id, userId, userName: userName });
    const interval = setInterval(() => {
      heartbeatMut({ roomId: room._id, userId, userName: userName });
    }, 5000);
    return () => clearInterval(interval);
  }, [room, userId, userName, heartbeatMut]);

  // State
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<YouTubeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubeArtist, setYoutubeArtist] = useState("");
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [isAddingYoutube, setIsAddingYoutube] = useState(false);
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
  const [voteInputs, setVoteInputs] = useState<Record<string, string>>({});
  const [confirmDestroy, setConfirmDestroy] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [settingsMaxSongs, setSettingsMaxSongs] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"queue" | "add" | "admin">("queue");

  const voteMap = useMemo(() => {
    const map = new Map<string, number>();
    votes?.forEach((v) => map.set(v.songId, v.value));
    return map;
  }, [votes]);

  const isAdmin = !!(room && userId && userId === room.hostUserId);
  const currentSong = songs?.find((s) => s._id === room?.currentSongId);

  const userSongCount = useMemo(() => {
    if (!songs || !userId) return 0;
    return songs.filter((s) => s.addedBy === userId).length;
  }, [songs, userId]);

  const maxSongsPerUser = room?.settings.maxSongsPerUser ?? 0;
  const atSongLimit = !isAdmin && maxSongsPerUser > 0 && userSongCount >= maxSongsPerUser;
  const allowGuestAdd = room?.settings.allowGuestAdd ?? true;
  const canAdd = isAdmin || (allowGuestAdd && !atSongLimit);

  const contributors = useMemo(() => {
    if (!songs || !userId) return [];
    const map = new Map<string, string>();
    songs.forEach((s) => {
      if (s.addedBy !== userId) map.set(s.addedBy, s.addedByName ?? "Anonymous");
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [songs, userId]);

  /* ── Handlers ───────────────────────────────────────── */

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearchError(null);
    setIsSearching(true);
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Search failed.");
      setSearchResults(data.results ?? []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFromSearch = async (track: YouTubeResult) => {
    if (!room || !userId || !canAdd) return;
    try {
      await addSong({
        roomId: room._id,
        provider: "youtube",
        providerId: track.id,
        title: track.title,
        artist: track.channel,
        albumArtUrl: track.thumbnailUrl,
        addedBy: userId,
        addedByName: userName,
      });
    } catch (err) {
      setYoutubeError(err instanceof Error ? err.message : "Failed to add.");
    }
  };

  const handleAddYouTube = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!room || !userId) return;
    const id = extractYouTubeId(youtubeUrl);
    if (!id) { setYoutubeError("Invalid YouTube URL."); return; }
    const name = youtubeTitle.trim();
    if (!name) { setYoutubeError("Add a title."); return; }
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
        addedByName: userName,
      });
      setYoutubeUrl("");
      setYoutubeTitle("");
      setYoutubeArtist("");
    } catch (err) {
      setYoutubeError(err instanceof Error ? err.message : "Failed to add.");
    } finally {
      setIsAddingYoutube(false);
    }
  };

  const handleVote = async (songId: Id<"songs">, nextValue: number) => {
    if (!room || !userId) return;
    try {
      await castVote({ roomId: room._id, songId, userId, value: nextValue });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vote failed.");
    }
  };

  const handleRemoveSong = async (songId: Id<"songs">) => {
    if (!userId) return;
    try {
      await removeSong({ songId, userId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed.");
    }
  };

  const handleLeaveRoom = async () => {
    if (!room || !userId) return;
    try {
      await leaveRoomMut({ roomId: room._id, userId });
    } catch {}
    onLeave();
  };

  const handleAdminSetScore = async (songId: Id<"songs">) => {
    if (!userId) return;
    const val = parseInt(scoreInputs[songId] ?? "", 10);
    if (isNaN(val)) return;
    try {
      await adminSetScore({ songId, userId, score: val });
      setScoreInputs((p) => ({ ...p, [songId]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    }
  };

  const handleAdminAddVotes = async (songId: Id<"songs">) => {
    if (!userId) return;
    const val = parseInt(voteInputs[songId] ?? "", 10);
    if (isNaN(val)) return;
    try {
      await adminAddVotes({ songId, userId, delta: val });
      setVoteInputs((p) => ({ ...p, [songId]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    }
  };

  const handleDestroyRoom = async () => {
    if (!room || !userId) return;
    try {
      await destroyRoom({ roomId: room._id, userId });
      onLeave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    }
  };

  const handleTransferHost = async () => {
    if (!room || !userId || !transferTarget) return;
    try {
      await transferHost({ roomId: room._id, userId, newHostUserId: transferTarget });
      setTransferTarget("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    }
  };

  const handleUpdateMaxSongs = async () => {
    if (!room || !userId) return;
    const val = parseInt(settingsMaxSongs, 10);
    if (isNaN(val) || val < 0) return;
    try {
      await updateSettings({ roomId: room._id, userId, settings: { maxSongsPerUser: val } });
      setSettingsMaxSongs("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    }
  };

  /* ── Loading / Not found ───────────────────────────── */

  if (room === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading room...</p>
      </div>
    );
  }

  if (room === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-destructive">Room not found</p>
        <Button size="sm" variant="outline" onClick={onLeave}>
          Back
        </Button>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-2 p-3 text-sm">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{room.name}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{room.code}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            👥 {userCount ?? 1}
          </Badge>
          <Badge variant="default" className="text-[10px] px-1.5 py-0">
            {songs?.length ?? 0} songs
          </Badge>
          {isAdmin && (
            <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-[10px] px-1.5 py-0">
              ★
            </Badge>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={handleLeaveRoom}
            className="h-5 text-[10px] px-2"
          >
            Leave
          </Button>
        </div>
      </div>

      {/* ── Now Playing / Reactions ─────────────────────── */}
      {currentSong ? (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-xl">
            <img
              src={`https://img.youtube.com/vi/${currentSong.providerId}/hqdefault.jpg`}
              alt={currentSong.title}
              className="w-full aspect-video object-cover opacity-80"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 py-2">
              <p className="text-xs font-semibold text-white drop-shadow truncate">
                {currentSong.title}
              </p>
              {currentSong.artist && (
                <p className="text-[10px] text-white/70 drop-shadow truncate">
                  {currentSong.artist}
                </p>
              )}
              {currentSong.addedByName && (
                <p className="text-[9px] text-white/50 drop-shadow truncate">
                  Added by {currentSong.addedByName}
                </p>
              )}
            </div>
            {/* Reaction Overlay */}
            <ReactionOverlay roomId={room._id} userId={userId} />
          </div>

          {/* Hidden audio-only player */}
          <div className="h-0 w-0 overflow-hidden">
            <YouTube
              videoId={currentSong.providerId}
              opts={{
                width: "1",
                height: "1",
                playerVars: { autoplay: 1, rel: 0 },
              }}
              onEnd={() => {
                if (room) advanceSong({ roomId: room._id });
              }}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            No song playing. Add one below!
          </p>
        </div>
      )}

      {/* ── Tab bar ─────────────────────────────────────── */}
      <div className="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
        {(["queue", "add", ...(isAdmin ? ["admin"] : [])] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              activeTab === tab
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            {tab === "queue" ? `Queue (${songs?.length ?? 0})` : tab === "add" ? "Add Song" : "Admin"}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────── */}

      {/* Queue */}
      {activeTab === "queue" && (
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
          {!songs || songs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No songs yet.
            </p>
          ) : (
            songs.map((song, index) => {
              const currentVote = voteMap.get(song._id) ?? 0;
              const canRemove = isAdmin || (userId && song.addedBy === userId);
              return (
                <div
                  key={song._id}
                  className="flex flex-col gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">
                        {index + 1}. {song.title}
                      </p>
                      <div className="flex items-center gap-1.5 min-w-0">
                        {song.artist && (
                          <p className="text-[10px] text-muted-foreground truncate max-w-[50%]">
                            {song.artist}
                          </p>
                        )}
                        {song.addedByName && (
                          <p className="text-[10px] text-muted-foreground/60 truncate">
                            • {song.addedByName}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant={currentVote === 1 ? "default" : "outline"}
                        className="h-5 w-5 p-0 text-[10px]"
                        onClick={() => handleVote(song._id, currentVote === 1 ? 0 : 1)}
                        disabled={!userId}
                      >
                        +
                      </Button>
                      {room.settings.allowDownvotes && (
                        <Button
                          size="sm"
                          variant={currentVote === -1 ? "secondary" : "outline"}
                          className="h-5 w-5 p-0 text-[10px]"
                          onClick={() => handleVote(song._id, currentVote === -1 ? 0 : -1)}
                          disabled={!userId}
                        >
                          −
                        </Button>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1 py-0 ${
                          song.score > 0
                            ? "border-green-500/40 text-green-400"
                            : song.score < 0
                              ? "border-red-500/40 text-red-400"
                              : ""
                        }`}
                      >
                        {song.score > 0 ? "+" : ""}
                        {song.score}
                      </Badge>
                      {canRemove && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 text-[10px] text-destructive hover:text-destructive"
                          onClick={() => handleRemoveSong(song._id)}
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Admin inline controls */}
                  {isAdmin && (
                    <div className="flex w-full items-center gap-1 border-t border-white/5 pt-1 mt-0.5">
                      <Input
                        className="w-14 h-5 text-[10px]"
                        placeholder="Score"
                        type="number"
                        value={scoreInputs[song._id] ?? ""}
                        onChange={(e) =>
                          setScoreInputs((p) => ({ ...p, [song._id]: e.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-5 text-[10px] px-1.5"
                        onClick={() => handleAdminSetScore(song._id)}
                      >
                        Set
                      </Button>
                      <Input
                        className="w-14 h-5 text-[10px]"
                        placeholder="+/-"
                        type="number"
                        value={voteInputs[song._id] ?? ""}
                        onChange={(e) =>
                          setVoteInputs((p) => ({ ...p, [song._id]: e.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-5 text-[10px] px-1.5"
                        onClick={() => handleAdminAddVotes(song._id)}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add Song */}
      {activeTab === "add" && (
        <div className="space-y-3">
          {/* Search */}
          <form className="space-y-2" onSubmit={handleSearch}>
            <div className="flex gap-1.5">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search YouTube..."
                className="h-7 text-xs"
              />
              <Button type="submit" size="sm" variant="secondary" disabled={isSearching} className="h-7 text-xs px-2 shrink-0">
                {isSearching ? "..." : "Search"}
              </Button>
            </div>
            {searchError && (
              <p className="text-[10px] text-destructive">{searchError}</p>
            )}
          </form>

          {searchResults.length > 0 && (
            <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
              {searchResults.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5"
                >
                  <div className="h-8 w-8 overflow-hidden rounded bg-black/30 shrink-0">
                    {track.thumbnailUrl && (
                      <img
                        src={track.thumbnailUrl}
                        alt={track.title}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold truncate">{track.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {track.channel}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="h-6 text-[10px] px-2 shrink-0"
                    onClick={() => handleAddFromSearch(track)}
                    disabled={!canAdd || !userId}
                  >
                    {atSongLimit ? "Limit" : "Add"}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="h-px w-full bg-white/5" />

          {/* Manual add */}
          <form className="space-y-2" onSubmit={handleAddYouTube}>
            <p className="text-[10px] text-muted-foreground font-medium">
              Or paste a YouTube link directly:
            </p>
            <Input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="YouTube URL or ID"
              className="h-7 text-xs"
            />
            <Input
              value={youtubeTitle}
              onChange={(e) => setYoutubeTitle(e.target.value)}
              placeholder="Track title"
              className="h-7 text-xs"
            />
            <Input
              value={youtubeArtist}
              onChange={(e) => setYoutubeArtist(e.target.value)}
              placeholder="Artist (optional)"
              className="h-7 text-xs"
            />
            <Button
              type="submit"
              disabled={isAddingYoutube || !canAdd}
              size="sm"
              className="w-full h-7 text-xs"
            >
              {!canAdd
                ? atSongLimit
                  ? "Limit reached"
                  : "Guest add disabled"
                : isAddingYoutube
                  ? "Adding..."
                  : "Add track"}
            </Button>
            {youtubeError && (
              <p className="text-[10px] text-destructive">{youtubeError}</p>
            )}
          </form>
        </div>
      )}

      {/* Admin */}
      {activeTab === "admin" && isAdmin && (
        <div className="space-y-3 rounded-xl border border-secondary/20 bg-secondary/5 p-3">
          <p className="text-xs font-semibold flex items-center gap-1">
            <span>★</span> Host Controls
          </p>

          {/* Settings */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold">Max songs per user</p>
            <div className="flex items-center gap-1.5">
              <Input
                className="w-16 h-6 text-[10px]"
                type="number"
                min={0}
                placeholder={String(maxSongsPerUser)}
                value={settingsMaxSongs}
                onChange={(e) => setSettingsMaxSongs(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleUpdateMaxSongs}
                className="h-6 text-[10px] px-2"
              >
                Update
              </Button>
            </div>
          </div>

          <div className="h-px w-full bg-white/5" />

          {/* Transfer Host */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold">Transfer Host</p>
            {contributors.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">
                No other contributors yet.
              </p>
            ) : (
              <div className="flex items-center gap-1.5">
                <select
                  className="h-6 rounded-md border border-white/10 bg-background px-1.5 text-[10px] flex-1"
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                >
                  <option value="">Select</option>
                  {contributors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTransferHost}
                  disabled={!transferTarget}
                  className="h-6 text-[10px] px-2"
                >
                  Transfer
                </Button>
              </div>
            )}
          </div>

          <div className="h-px w-full bg-white/5" />

          {/* Destroy */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-destructive">
              Danger Zone
            </p>
            {confirmDestroy ? (
              <div className="flex items-center gap-1.5">
                <p className="text-[10px]">Are you sure?</p>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDestroyRoom}
                  className="h-6 text-[10px] px-2"
                >
                  Yes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDestroy(false)}
                  className="h-6 text-[10px] px-2"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmDestroy(true)}
                className="h-6 text-[10px] px-2"
              >
                Destroy Room
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-[10px] text-destructive text-center">{error}</p>
      )}

      {/* Footer */}
      <div className="text-center pt-1">
        <p className="text-[9px] text-muted-foreground/50">
          Powered by{" "}
          <a
            href="https://github.com/ACM-VIT/synesthesia"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-muted-foreground"
          >
            Synesthesia
          </a>
        </p>
      </div>
    </div>
  );
}
