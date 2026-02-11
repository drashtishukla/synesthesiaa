"use client";

import {
  Suspense,
  type FormEvent,
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUserId, useUserName } from "@/app/lib/useUserId";
import YouTube from "react-youtube";

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

/* ─── shared UI primitives ─────────────────────────────────────────────── */

function WInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={
        "h-9 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-foreground " +
        "placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 " +
        "transition-colors " +
        className
      }
      {...props}
    />
  );
}

function WBtn({
  variant = "default",
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "ghost";
}) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors " +
    "disabled:opacity-40 disabled:pointer-events-none ";
  const variants: Record<string, string> = {
    default:
      "border border-white/10 bg-white/5 text-foreground hover:bg-white/10",
    primary: "bg-primary text-primary-foreground hover:bg-primary/80",
    danger:
      "bg-destructive/10 text-red-400 border border-red-500/20 hover:bg-destructive/20",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-white/5",
  };
  return (
    <button className={base + variants[variant] + " " + className} {...props}>
      {children}
    </button>
  );
}

type WidgetView = "lobby" | "room";

/* ═══════════════════════════════════════════════════════════════════════ */

function EmbedPageInner() {
  const userId = useUserId();
  const [userName, setUserName] = useUserName();
  const searchParams = useSearchParams();
  const paramRoom = searchParams.get("room");

  const [view, setView] = useState<WidgetView>(paramRoom ? "room" : "lobby");
  const [roomCode, setRoomCode] = useState<string | null>(paramRoom);

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

export default function EmbedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-12">
          <p className="text-sm text-muted-foreground animate-pulse">
            Loading…
          </p>
        </div>
      }
    >
      <EmbedPageInner />
    </Suspense>
  );
}

/* ─── Username Prompt ──────────────────────────────────────────────────── */

function UsernamePrompt({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [input, setInput] = useState("");
  return (
    <div className="flex items-center justify-center p-6 min-h-[320px]">
      <div className="w-full max-w-xs space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold">What should we call you?</h2>
          <p className="text-xs text-muted-foreground">
            So others know who added songs
          </p>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const name = input.trim();
            if (name) onSubmit(name);
          }}
        >
          <WInput
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Your name"
            autoFocus
          />
          <WBtn
            type="submit"
            variant="primary"
            disabled={!input.trim()}
            className="w-full h-9"
          >
            Continue
          </WBtn>
        </form>
      </div>
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
      setError("Generating user id — try again.");
      return;
    }
    setError(null);
    setIsCreating(true);
    try {
      const name = roomName.trim() || "Untitled Room";
      const result = await createRoom({
        name,
        hostUserId: userId,
        maxSongsPerUser,
      });
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
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="text-center space-y-1 py-3">
        <h1 className="text-xl font-semibold text-glow">synesthesia</h1>
        <p className="text-[11px] text-muted-foreground">
          Crowd-controlled music queue
        </p>
      </div>

      {/* Create room */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
        <h3 className="text-sm font-semibold">Start a room</h3>
        <form className="space-y-2.5" onSubmit={handleCreate}>
          <WInput
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Room name"
          />
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-muted-foreground whitespace-nowrap">
              Songs / user
            </label>
            <WInput
              type="number"
              min={0}
              value={maxSongsPerUser}
              onChange={(e) => setMaxSongsPerUser(Number(e.target.value))}
              className="!w-16"
            />
            <WBtn
              type="submit"
              variant="primary"
              disabled={isCreating}
              className="ml-auto"
            >
              {isCreating ? "Creating…" : "Create"}
            </WBtn>
          </div>
        </form>
      </div>

      {/* Join room */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h3 className="text-sm font-semibold">Join a room</h3>
        <form className="flex gap-2" onSubmit={handleJoin}>
          <WInput
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Room code"
            className="uppercase"
          />
          <WBtn type="submit" className="shrink-0">
            Join
          </WBtn>
        </form>
      </div>

      {error && <p className="text-xs text-red-400 px-1">{error}</p>}
    </div>
  );
}

/* ─── Room ─────────────────────────────────────────────────────────────── */

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
  const room = useQuery(api.rooms.getRoomByCode, {
    code: code.toUpperCase(),
  });
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

  // Presence
  const userCount = useQuery(
    api.presence.list,
    room ? { roomId: room._id } : "skip",
  );
  const heartbeatMut = useMutation(api.presence.heartbeat);
  const leaveRoomMut = useMutation(api.presence.leave);

  useEffect(() => {
    if (!room || !userId) return;
    heartbeatMut({ roomId: room._id, userId, userName });
    const interval = setInterval(() => {
      heartbeatMut({ roomId: room._id, userId, userName });
    }, 5000);
    return () => clearInterval(interval);
  }, [room, userId, userName, heartbeatMut]);

  // Local state
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
  const [confirmDestroy, setConfirmDestroy] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [settingsMaxSongs, setSettingsMaxSongs] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"queue" | "add" | "admin">(
    "queue",
  );

  // YouTube player & progress
  const ytPlayerRef = useRef<any>(null);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const p = ytPlayerRef.current;
      if (p) {
        try {
          const cur = p.getCurrentTime?.() ?? 0;
          const dur = p.getDuration?.() ?? 0;
          setCurrentTime(cur);
          setDuration(dur);
          setProgress(dur > 0 ? cur / dur : 0);
        } catch {}
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const fmtTime = useCallback((s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }, []);

  const voteMap = useMemo(() => {
    const map = new Map<string, number>();
    votes?.forEach((v) => map.set(v.songId, v.value));
    return map;
  }, [votes]);

  const isAdmin = !!(room && userId && userId === room.hostUserId);
  const currentSong = songs?.find((s) => s._id === room?.currentSongId);

  useEffect(() => {
    if (!currentSong) {
      ytPlayerRef.current = null;
      setProgress(0);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [currentSong]);

  // Notify parent window via postMessage
  useEffect(() => {
    if (typeof window === "undefined" || window === window.parent) return;
    try {
      window.parent.postMessage(
        {
          type: "synesthesia:state",
          roomCode: code,
          roomName: room?.name ?? null,
          currentSong: currentSong
            ? { title: currentSong.title, artist: currentSong.artist ?? null }
            : null,
          queueLength: songs?.length ?? 0,
          isAdmin,
        },
        "*",
      );
    } catch {}
  }, [code, room?.name, currentSong, songs?.length, isAdmin]);

  const userSongCount = useMemo(() => {
    if (!songs || !userId) return 0;
    return songs.filter((s) => s.addedBy === userId).length;
  }, [songs, userId]);

  const maxSongsPerUser = room?.settings.maxSongsPerUser ?? 0;
  const atSongLimit =
    !isAdmin && maxSongsPerUser > 0 && userSongCount >= maxSongsPerUser;
  const allowGuestAdd = room?.settings.allowGuestAdd ?? true;
  const canAdd = isAdmin || (allowGuestAdd && !atSongLimit);

  const contributors = useMemo(() => {
    if (!songs || !userId) return [];
    const map = new Map<string, string>();
    songs.forEach((s) => {
      if (s.addedBy !== userId)
        map.set(s.addedBy, s.addedByName ?? "Anonymous");
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [songs, userId]);

  /* ── Handlers ───────────────────────────────────────── */

  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearchError(null);
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(q)}`,
      );
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
    if (!id) {
      setYoutubeError("Invalid YouTube URL.");
      return;
    }
    const name = youtubeTitle.trim();
    if (!name) {
      setYoutubeError("Add a title.");
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
      await transferHost({
        roomId: room._id,
        userId,
        newHostUserId: transferTarget,
      });
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
      await updateSettings({
        roomId: room._id,
        userId,
        settings: { maxSongsPerUser: val },
      });
      setSettingsMaxSongs("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    }
  };

  /* ── Loading / Not found ───────────────────────────── */

  if (room === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground animate-pulse">
          Loading…
        </p>
      </div>
    );
  }

  if (room === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12">
        <p className="text-sm font-medium text-red-400">Room not found</p>
        <WBtn onClick={onLeave}>Back</WBtn>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full max-h-[650px] p-3 gap-3">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold truncate">{room.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <button
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/15 transition-colors"
              title="Copy room code"
            >
              {room.code}
              <span className="text-[10px]">{copied ? "✓" : "⎘"}</span>
            </button>
            <span className="text-[11px] text-muted-foreground">
              👥 {userCount ?? 1}
            </span>
            {isAdmin && (
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                Host
              </span>
            )}
          </div>
        </div>
        <WBtn
          variant="danger"
          onClick={handleLeaveRoom}
          className="shrink-0 text-[10px]"
        >
          Leave
        </WBtn>
      </div>

      {/* ── Now Playing ────────────────────────────────── */}
      <div className="relative rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        {currentSong ? (
          <>
            <div className="relative">
              <img
                src={`https://img.youtube.com/vi/${currentSong.providerId}/mqdefault.jpg`}
                alt=""
                className="w-full aspect-video object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 inset-x-0 p-3">
                <p className="text-sm font-semibold text-white truncate">
                  {currentSong.title}
                </p>
                <p className="text-[11px] text-white/60 truncate">
                  {currentSong.artist}
                  {currentSong.addedByName &&
                    ` · ${currentSong.addedByName}`}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="px-3 pb-2 pt-1.5 space-y-1">
              <div
                className="relative h-1.5 w-full rounded-full bg-white/10 overflow-hidden cursor-pointer group"
                onClick={(e) => {
                  const p = ytPlayerRef.current;
                  if (!p || duration <= 0) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  p.seekTo(ratio * duration, true);
                }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-200 group-hover:bg-primary/90"
                  style={{
                    width: `${(progress * 100).toFixed(1)}%`,
                  }}
                />
              </div>
              {duration > 0 && (
                <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                  <span>{fmtTime(currentTime)}</span>
                  <span>{fmtTime(duration)}</span>
                </div>
              )}
            </div>

            {/* Transport (admin only) */}
            {isAdmin && (
              <div className="flex items-center justify-center gap-2 pb-2.5">
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
                  title={isPlaying ? "Pause" : "Play"}
                  onClick={() => {
                    const p = ytPlayerRef.current;
                    if (!p) return;
                    if (isPlaying) {
                      p.pauseVideo();
                      setIsPlaying(false);
                    } else {
                      p.playVideo();
                      setIsPlaying(true);
                    }
                  }}
                >
                  {isPlaying ? "⏸" : "▶"}
                </button>
                <button
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 transition-colors text-xs"
                  title="Skip"
                  onClick={() => advanceSong({ roomId: room._id })}
                >
                  ⏭
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-1">
            <p className="text-sm text-muted-foreground">No song playing</p>
            <p className="text-[11px] text-muted-foreground/60">
              Add a track to get started
            </p>
          </div>
        )}
      </div>

      {/* Hidden YouTube player */}
      {currentSong && (
        <div className="h-0 w-0 overflow-hidden">
          <YouTube
            videoId={currentSong.providerId}
            opts={{
              width: "1",
              height: "1",
              playerVars: { autoplay: 1, rel: 0 },
            }}
            onReady={(e: any) => {
              ytPlayerRef.current = e.target;
            }}
            onStateChange={(e: any) => {
              // 1 = playing, 2 = paused
              if (e.data === 1) setIsPlaying(true);
              else if (e.data === 2) setIsPlaying(false);
            }}
            onEnd={() => {
              if (room) advanceSong({ roomId: room._id });
            }}
          />
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-white/10">
        {(
          ["queue", "add", ...(isAdmin ? ["admin"] : [])] as const
        ).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            className={`flex-1 py-1.5 text-[11px] font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            {tab === "queue"
              ? `Queue (${songs?.length ?? 0})`
              : tab === "add"
                ? "Add"
                : "Host"}
          </button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Queue */}
        {activeTab === "queue" && (
          <div className="overflow-y-auto max-h-[280px] space-y-1 pr-1">
            {!songs || songs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Queue is empty
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
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors ${
                      isCurrent
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <span
                      className={`text-[11px] w-5 text-right shrink-0 tabular-nums ${
                        isCurrent
                          ? "text-primary font-semibold"
                          : "text-muted-foreground"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-medium truncate ${
                          isCurrent ? "text-primary" : ""
                        }`}
                      >
                        {song.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {song.artist}
                        {song.addedByName && ` · ${song.addedByName}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        className={`h-6 w-6 rounded-md text-[11px] flex items-center justify-center transition-colors ${
                          currentVote === 1
                            ? "bg-primary/20 text-primary"
                            : "text-muted-foreground hover:bg-white/10"
                        }`}
                        onClick={() =>
                          handleVote(song._id, currentVote === 1 ? 0 : 1)
                        }
                        disabled={!userId}
                      >
                        ▲
                      </button>
                      {room.settings.allowDownvotes && (
                        <button
                          className={`h-6 w-6 rounded-md text-[11px] flex items-center justify-center transition-colors ${
                            currentVote === -1
                              ? "bg-red-500/20 text-red-400"
                              : "text-muted-foreground hover:bg-white/10"
                          }`}
                          onClick={() =>
                            handleVote(
                              song._id,
                              currentVote === -1 ? 0 : -1,
                            )
                          }
                          disabled={!userId}
                        >
                          ▼
                        </button>
                      )}
                      <span
                        className={`text-[11px] w-6 text-center tabular-nums font-medium ${
                          song.score > 0
                            ? "text-green-400"
                            : song.score < 0
                              ? "text-red-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {song.score > 0 ? "+" : ""}
                        {song.score}
                      </span>
                      {canRemove && (
                        <button
                          className="h-6 w-6 rounded-md text-[11px] text-muted-foreground hover:text-red-400 hover:bg-white/5 flex items-center justify-center transition-colors"
                          onClick={() => handleRemoveSong(song._id)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Add Song */}
        {activeTab === "add" && (
          <div className="overflow-y-auto max-h-[280px] space-y-4 pr-1">
            <form className="flex gap-2" onSubmit={handleSearch}>
              <WInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search YouTube…"
              />
              <WBtn
                type="submit"
                variant="primary"
                disabled={isSearching}
                className="shrink-0"
              >
                {isSearching ? "…" : "Search"}
              </WBtn>
            </form>
            {searchError && (
              <p className="text-[11px] text-red-400">{searchError}</p>
            )}
            {searchResults.length > 0 && (
              <div className="space-y-1.5">
                {searchResults.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/[0.07] transition-colors"
                  >
                    {track.thumbnailUrl && (
                      <img
                        src={track.thumbnailUrl}
                        alt=""
                        className="h-9 w-9 rounded object-cover shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {track.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {track.channel}
                      </p>
                    </div>
                    <WBtn
                      variant="primary"
                      onClick={() => handleAddFromSearch(track)}
                      disabled={!canAdd || !userId}
                      className="text-[10px] shrink-0"
                    >
                      {atSongLimit ? "Limit" : "Add"}
                    </WBtn>
                  </div>
                ))}
              </div>
            )}

            <div className="h-px bg-white/5" />

            <form className="space-y-2" onSubmit={handleAddYouTube}>
              <p className="text-[11px] text-muted-foreground font-medium">
                Or paste a link
              </p>
              <WInput
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="YouTube URL or ID"
              />
              <WInput
                value={youtubeTitle}
                onChange={(e) => setYoutubeTitle(e.target.value)}
                placeholder="Track title"
              />
              <WInput
                value={youtubeArtist}
                onChange={(e) => setYoutubeArtist(e.target.value)}
                placeholder="Artist (optional)"
              />
              <WBtn
                type="submit"
                variant="primary"
                disabled={isAddingYoutube || !canAdd}
                className="w-full h-9"
              >
                {!canAdd
                  ? atSongLimit
                    ? "Song limit reached"
                    : "Guest add disabled"
                  : isAddingYoutube
                    ? "Adding…"
                    : "Add track"}
              </WBtn>
              {youtubeError && (
                <p className="text-[11px] text-red-400">{youtubeError}</p>
              )}
            </form>
          </div>
        )}

        {/* Admin */}
        {activeTab === "admin" && isAdmin && (
          <div className="overflow-y-auto max-h-[280px] space-y-4 pr-1">
            <div className="space-y-2">
              <p className="text-xs font-medium">Max songs per user</p>
              <div className="flex gap-2">
                <WInput
                  type="number"
                  min={0}
                  placeholder={String(maxSongsPerUser)}
                  value={settingsMaxSongs}
                  onChange={(e) => setSettingsMaxSongs(e.target.value)}
                  className="!w-20"
                />
                <WBtn onClick={handleUpdateMaxSongs}>Update</WBtn>
              </div>
            </div>

            <div className="h-px bg-white/5" />

            <div className="space-y-2">
              <p className="text-xs font-medium">Transfer host</p>
              {contributors.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  No other users yet
                </p>
              ) : (
                <div className="flex gap-2">
                  <select
                    className="h-9 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-foreground outline-none"
                    value={transferTarget}
                    onChange={(e) => setTransferTarget(e.target.value)}
                  >
                    <option value="">Select user</option>
                    {contributors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <WBtn
                    onClick={handleTransferHost}
                    disabled={!transferTarget}
                  >
                    Transfer
                  </WBtn>
                </div>
              )}
            </div>

            <div className="h-px bg-white/5" />

            <div className="space-y-2">
              <p className="text-xs font-medium text-red-400">Danger zone</p>
              {confirmDestroy ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs">Are you sure?</span>
                  <WBtn variant="danger" onClick={handleDestroyRoom}>
                    Yes, destroy
                  </WBtn>
                  <WBtn onClick={() => setConfirmDestroy(false)}>Cancel</WBtn>
                </div>
              ) : (
                <WBtn
                  variant="danger"
                  onClick={() => setConfirmDestroy(true)}
                >
                  Destroy room
                </WBtn>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && <p className="text-[11px] text-red-400 px-1">{error}</p>}
    </div>
  );
}
