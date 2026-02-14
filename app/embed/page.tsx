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

/* ─── shared UI primitives ─────────────────────────────────────────────── */

function WInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={
        "h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-foreground " +
        "placeholder:text-white/20 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 " +
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
    "inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200 " +
    "disabled:opacity-40 disabled:pointer-events-none ";
  const variants: Record<string, string> = {
    default:
      "border border-white/[0.08] bg-white/[0.04] text-foreground hover:bg-white/[0.08]",
    primary: "bg-primary text-white hover:brightness-110 shadow-sm shadow-primary/20",
    danger:
      "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]",
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
      <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 space-y-3">
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
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
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
  const [confirmDestroy, setConfirmDestroy] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [settingsMaxSongs, setSettingsMaxSongs] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"queue" | "add" | "admin">(
    "queue",
  );
  const [expanded, setExpanded] = useState(false);

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

  const queueSongs = useMemo(
    () => songs?.filter((s) => s._id !== room?.currentSongId) ?? [],
    [songs, room?.currentSongId],
  );

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
      setSearchError(err instanceof Error ? err.message : "Failed to add.");
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
    <div className="flex flex-col w-full max-w-[420px] mx-auto">
      {/* ═══ Mini Player Card ═══ */}
      <div className="bg-[#121212] rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/[0.04]">
        {/* ── Now Playing Row ─── */}
        <div className="flex items-center gap-3 p-3">
          {/* Album Art */}
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10 shrink-0 flex items-center justify-center">
            {currentSong ? (
              <img
                src={`https://img.youtube.com/vi/${currentSong.providerId}/mqdefault.jpg`}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <svg className="w-6 h-6 text-white/30" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            )}
          </div>

          {/* Title & Artist */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {currentSong?.title ?? "Nothing playing"}
            </p>
            <p className="text-xs text-white/50 truncate">
              {currentSong
                ? `${currentSong.artist ?? "Unknown"}${currentSong.addedByName ? ` · ${currentSong.addedByName}` : ""}`
                : "Add a song to get started"}
            </p>
          </div>

          {/* Add + Expand + Close */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              className="w-7 h-7 flex items-center justify-center rounded-full text-white/40 hover:text-green-400 hover:bg-white/10 transition-colors text-lg font-light"
              onClick={() => {
                setActiveTab("add");
                setExpanded(true);
              }}
              title="Add song"
            >
              +
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center rounded-full text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors text-sm"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Collapse" : "Expand queue"}
            >
              {expanded ? "▾" : "▸"}
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center rounded-full text-white/40 hover:text-red-400 hover:bg-white/10 transition-colors"
              onClick={handleLeaveRoom}
              title="Leave room"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Progress Bar ─── */}
        {currentSong && (
          <div className="px-3 pb-1">
            <div
              className="relative h-1 w-full rounded-full bg-white/10 overflow-hidden cursor-pointer group"
              onClick={(e) => {
                const p = ytPlayerRef.current;
                if (!p || duration <= 0) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                p.seekTo(ratio * duration, true);
              }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-300 group-hover:bg-primary/80"
                style={{ width: `${(progress * 100).toFixed(1)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-white/30 tabular-nums">
              <span>{fmtTime(currentTime)}</span>
              <span>-{fmtTime(Math.max(0, duration - currentTime))}</span>
            </div>
          </div>
        )}

        {/* ── Transport Controls ─── */}
        {currentSong && (
          <div className="flex items-center justify-center gap-4 pb-3">
            {/* Previous / Rewind */}
            <button
              className="w-9 h-9 flex items-center justify-center rounded-full text-white/50 hover:text-white transition-colors"
              title="Restart"
              onClick={() => {
                const p = ytPlayerRef.current;
                if (p) p.seekTo(0, true);
              }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>

            {/* Play / Pause */}
            {isAdmin ? (
              <button
                className="w-11 h-11 flex items-center justify-center rounded-full bg-white text-black hover:bg-white/90 transition-colors"
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
                {isPlaying ? (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>
            ) : (
              <div
                className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white/50"
                title={isPlaying ? "Playing" : "Paused"}
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </div>
            )}

            {/* Next / Skip */}
            <button
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                isAdmin
                  ? "text-white/50 hover:text-white"
                  : "text-white/20 cursor-not-allowed"
              }`}
              title="Skip"
              onClick={() => {
                if (isAdmin) advanceSong({ roomId: room._id });
              }}
              disabled={!isAdmin}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>
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
              if (e.data === 1) setIsPlaying(true);
              else if (e.data === 2) setIsPlaying(false);
            }}
            onEnd={() => {
              if (room && isAdmin) advanceSong({ roomId: room._id });
            }}
          />
        </div>
      )}

      {/* ═══ Expandable Panel ═══ */}
      {expanded && (
        <div className="bg-[#0e0e0e] rounded-2xl mt-2 overflow-hidden shadow-lg shadow-black/40 border border-white/[0.04]">
          {/* Room info bar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-white truncate">{room.name}</span>
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-0.5 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/50 hover:text-white hover:bg-white/15 rounded transition-colors shrink-0"
                title="Copy room code"
              >
                {room.code}
                <span className="text-[9px] ml-0.5">{copied ? "✓" : "⎘"}</span>
              </button>
              <span className="text-[10px] text-primary font-medium">{userCount ?? 1} online</span>
              {isAdmin && (
                <span className="bg-primary/15 px-1.5 py-0.5 rounded-md text-[9px] font-medium text-primary">Host</span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/5">
            {(["queue", "add", ...(isAdmin ? ["admin"] : [])] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as typeof activeTab)}
                className={`flex-1 py-2 text-[11px] font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "text-primary border-primary"
                    : "text-white/40 border-transparent hover:text-white/70"
                }`}
              >
                {tab === "queue" ? `Queue (${queueSongs.length})` : tab === "add" ? "Add" : "Host"}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="max-h-[240px] overflow-y-auto">
            {/* Queue */}
            {activeTab === "queue" && (
              <div className="py-1">
                {queueSongs.length === 0 ? (
                  <p className="text-[11px] text-white/30 text-center py-6">Queue is empty</p>
                ) : (
                  queueSongs.slice(0, 3).map((song, index) => {
                    const currentVote = voteMap.get(song._id) ?? 0;
                    const canRemove = isAdmin || (userId && song.addedBy === userId);
                    return (
                      <div
                        key={song._id}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors"
                      >
                        <span className="text-[10px] w-4 text-right text-white/25 tabular-nums shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{song.title}</p>
                          <p className="text-[10px] text-white/40 truncate">
                            {song.artist}{song.addedByName && ` · ${song.addedByName}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            className={`w-6 h-6 flex items-center justify-center rounded text-[10px] transition-colors ${
                              currentVote === 1 ? "text-primary bg-primary/20" : "text-white/30 hover:bg-white/10"
                            }`}
                            onClick={() => handleVote(song._id, currentVote === 1 ? 0 : 1)}
                          >▲</button>
                          {room.settings.allowDownvotes && (
                            <button
                              className={`w-6 h-6 flex items-center justify-center rounded text-[10px] transition-colors ${
                                currentVote === -1 ? "text-red-400 bg-red-500/20" : "text-white/30 hover:bg-white/10"
                              }`}
                              onClick={() => handleVote(song._id, currentVote === -1 ? 0 : -1)}
                            >▼</button>
                          )}
                          <span className={`text-[10px] w-5 text-center tabular-nums font-medium ${
                            song.score > 0 ? "text-green-400" : song.score < 0 ? "text-red-400" : "text-white/25"
                          }`}>
                            {song.score > 0 ? "+" : ""}{song.score}
                          </span>
                          {canRemove && (
                            <button
                              className="w-6 h-6 flex items-center justify-center rounded text-white/25 hover:text-red-400 hover:bg-white/5 text-[10px] transition-colors"
                              onClick={() => handleRemoveSong(song._id)}
                            >✕</button>
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
              <div className="p-3 space-y-2">
                <form className="flex gap-1.5" onSubmit={handleSearch}>
                  <WInput
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search YouTube…"
                    className="!h-8 !text-xs"
                  />
                  <WBtn type="submit" variant="primary" disabled={isSearching} className="shrink-0 !text-[10px]">
                    {isSearching ? "…" : "Search"}
                  </WBtn>
                </form>
                {searchError && <p className="text-[10px] text-red-400">{searchError}</p>}
                {searchResults.length > 0 && (
                  <div className="space-y-1">
                    {searchResults.slice(0, 3).map((track) => (
                      <div key={track.id} className="flex items-center gap-2 rounded-xl bg-white/[0.03] p-1.5 hover:bg-white/[0.06] border border-white/[0.04] transition-colors">
                        {track.thumbnailUrl && (
                          <img src={track.thumbnailUrl} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-white truncate">{track.title}</p>
                          <p className="text-[10px] text-white/40 truncate">{track.channel}</p>
                        </div>
                        <WBtn variant="primary" onClick={() => handleAddFromSearch(track)} disabled={!canAdd || !userId} className="!text-[9px] shrink-0">
                          {atSongLimit ? "Limit" : "+"}
                        </WBtn>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Admin */}
            {activeTab === "admin" && isAdmin && (
              <div className="p-3 space-y-3">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-white">Max songs / user</p>
                  <div className="flex gap-1.5">
                    <WInput type="number" min={0} placeholder={String(maxSongsPerUser)} value={settingsMaxSongs} onChange={(e) => setSettingsMaxSongs(e.target.value)} className="!w-16 !h-8 !text-xs" />
                    <WBtn onClick={handleUpdateMaxSongs} className="!text-[10px]">Update</WBtn>
                  </div>
                </div>
                <div className="h-px bg-white/5" />
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-white">Transfer host</p>
                  {contributors.length === 0 ? (
                    <p className="text-[10px] text-white/30">No other users yet</p>
                  ) : (
                    <div className="flex gap-1.5">
                      <select className="h-8 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 text-[11px] text-white outline-none" value={transferTarget} onChange={(e) => setTransferTarget(e.target.value)}>
                        <option value="">Select user</option>
                        {contributors.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                      </select>
                      <WBtn onClick={handleTransferHost} disabled={!transferTarget} className="!text-[10px]">Transfer</WBtn>
                    </div>
                  )}
                </div>
                <div className="h-px bg-white/5" />
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-red-400">Danger zone</p>
                  {confirmDestroy ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-white">Sure?</span>
                      <WBtn variant="danger" onClick={handleDestroyRoom} className="!text-[10px]">Yes, destroy</WBtn>
                      <WBtn onClick={() => setConfirmDestroy(false)} className="!text-[10px]">Cancel</WBtn>
                    </div>
                  ) : (
                    <WBtn variant="danger" onClick={() => setConfirmDestroy(true)} className="!text-[10px]">Destroy room</WBtn>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-[10px] text-red-400 mt-1 px-1">{error}</p>}
    </div>
  );
}
