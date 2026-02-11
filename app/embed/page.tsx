"use client";

import { type FormEvent, useMemo, useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUserId, useUserName } from "@/app/lib/useUserId";
import YouTube from "react-youtube";
import ReactionOverlay from "@/components/ReactionOverlay";
import "./retro.css";

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
    <div className="retro-player flex items-center justify-center p-6 min-h-[300px]">
      <div className="w-full max-w-xs space-y-4">
        <div className="text-center space-y-1">
          <span className="retro-brand">synesthesia</span>
        </div>
        <div className="retro-lcd px-4 py-4 space-y-3">
          <p className="retro-lcd-text text-sm text-center">ENTER YOUR NAME</p>
          <p className="retro-lcd-dim text-[10px] text-center">So others know who added songs</p>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const name = input.trim();
              if (name) onSubmit(name);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="YOUR NAME"
              className="retro-input w-full h-8 text-sm"
              autoFocus
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="retro-btn retro-btn-primary w-full py-2 text-[10px]"
            >
              CONTINUE ▶
            </button>
          </form>
        </div>
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
    <div className="retro-player flex flex-col gap-3 p-4">
      {/* Brand */}
      <div className="text-center space-y-2 py-2">
        <div className="flex items-center justify-center gap-2">
          <div className="retro-led retro-led-green" />
          <span className="retro-amber-text text-lg"
                style={{ fontFamily: "var(--retro-font)", letterSpacing: "2px" }}>
            SYNESTHESIA
          </span>
          <div className="retro-led retro-led-green" />
        </div>
        <p className="retro-lcd-dim text-[10px]">CROWD-CONTROLLED MUSIC QUEUE</p>
      </div>

      {/* Create */}
      <div className="retro-lcd px-3 py-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="retro-led retro-led-amber" />
          <span className="retro-amber-text text-[10px]">NEW ROOM</span>
        </div>
        <form className="space-y-2" onSubmit={handleCreate}>
          <input
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="ROOM NAME"
            className="retro-input w-full h-7 text-[12px]"
          />
          <div className="flex items-center gap-2">
            <span className="retro-lcd-dim text-[9px] whitespace-nowrap">SONGS/USER</span>
            <input
              type="number"
              min={0}
              value={maxSongsPerUser}
              onChange={(e) => setMaxSongsPerUser(Number(e.target.value))}
              className="retro-input h-6 text-[12px] w-14"
            />
            <button
              type="submit"
              disabled={isCreating}
              className="retro-btn retro-btn-primary ml-auto px-3 py-1 text-[9px]"
            >
              {isCreating ? "..." : "CREATE ▶"}
            </button>
          </div>
        </form>
      </div>

      <div className="retro-groove" />

      {/* Join */}
      <div className="retro-lcd px-3 py-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="retro-led retro-led-green" />
          <span className="retro-lcd-text text-[10px]">JOIN ROOM</span>
        </div>
        <form className="flex items-center gap-2" onSubmit={handleJoin}>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="ROOM CODE"
            className="retro-input flex-1 h-7 text-[12px] uppercase"
          />
          <button
            type="submit"
            className="retro-btn px-3 py-1 text-[9px]"
          >
            JOIN ▶
          </button>
        </form>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 px-1">
          <div className="retro-led retro-led-red" />
          <p className="text-[10px] text-[#cc6666]" style={{ fontFamily: "var(--retro-font)" }}>
            {error}
          </p>
        </div>
      )}

      <div className="flex items-center justify-center">
        <span className="retro-brand">powered by synesthesia</span>
      </div>
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
      <div className="retro-player flex items-center justify-center p-8">
        <span className="retro-lcd-dim text-sm">LOADING...</span>
      </div>
    );
  }

  if (room === null) {
    return (
      <div className="retro-player flex flex-col items-center justify-center gap-3 p-8">
        <div className="retro-led retro-led-red" />
        <span className="retro-amber-text text-sm">ROOM NOT FOUND</span>
        <button className="retro-btn px-3 py-1 text-[9px]" onClick={onLeave}>
          ◀ BACK
        </button>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────── */

  return (
    <div className="retro-player flex flex-col h-full max-h-[650px] p-3 gap-2.5">

      {/* ── Top bezel: brand + room info ────────────────── */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="retro-brand">synesthesia</span>
          <div className={`retro-led ${currentSong ? "retro-led-green" : "retro-led-off"}`} />
        </div>
        <div className="flex items-center gap-2">
          <span className="retro-lcd-dim text-[11px]">👥 {userCount ?? 1}</span>
          {isAdmin && <div className="retro-led retro-led-amber" title="Host" />}
          <button
            onClick={handleLeaveRoom}
            className="retro-btn retro-btn-danger px-2 py-0.5 text-[8px]"
          >
            EJECT
          </button>
        </div>
      </div>

      {/* ── LCD Screen ──────────────────────────────────── */}
      <div className="retro-lcd px-3 py-2.5 flex flex-col gap-1.5 relative z-0">
        {currentSong ? (
          <>
            {/* Room name + code */}
            <div className="flex justify-between items-center">
              <span className="retro-lcd-dim text-[10px]">{room.name}</span>
              <span className="retro-lcd-dim text-[10px]">{room.code}</span>
            </div>

            {/* Marquee title */}
            <div className="retro-marquee text-lg leading-tight relative z-10">
              <span className="retro-marquee-scroll">
                {currentSong.title}
                {currentSong.artist ? ` — ${currentSong.artist}` : ""}
                {"    ♫    "}
              </span>
            </div>

            {/* Info row */}
            <div className="flex justify-between items-center relative z-10">
              <span className="retro-lcd-dim text-[10px]">
                {currentSong.addedByName ? `by ${currentSong.addedByName}` : ""}
              </span>
              <div className="flex items-center gap-2">
                {/* Equalizer bars */}
                <div className="retro-eq">
                  <div className="retro-eq-bar" />
                  <div className="retro-eq-bar" />
                  <div className="retro-eq-bar" />
                  <div className="retro-eq-bar" />
                  <div className="retro-eq-bar" />
                </div>
                <span className="retro-amber-text text-[10px]">PLAYING</span>
              </div>
            </div>

            {/* Fake progress */}
            <div className="retro-progress-track mt-0.5 relative z-10">
              <div className="retro-progress-fill" style={{ width: "35%" }} />
            </div>

            {/* Reactions */}
            <div className="absolute inset-0 z-20 pointer-events-auto">
              <ReactionOverlay roomId={room._id} userId={userId} />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 gap-1">
            <span className="retro-lcd-dim text-sm">NO DISC</span>
            <span className="retro-lcd-dim text-[10px]">Insert track below</span>
          </div>
        )}
      </div>

      {/* Hidden audio-only player */}
      {currentSong && (
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
      )}

      {/* ── Transport controls ─────────────────────────── */}
      {isAdmin && currentSong && (
        <div className="flex items-center justify-center gap-1.5">
          <button
            className="retro-transport-btn"
            title="Previous"
            onClick={() => {}}
          >
            ⏮
          </button>
          <button
            className="retro-transport-btn active"
            title="Playing"
          >
            ▶
          </button>
          <button
            className="retro-transport-btn"
            title="Skip"
            onClick={() => { if (room) advanceSong({ roomId: room._id }); }}
          >
            ⏭
          </button>
        </div>
      )}

      {/* ── Tab selector ───────────────────────────────── */}
      <div className="flex gap-px">
        {(["queue", "add", ...(isAdmin ? ["admin"] : [])] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            className={`retro-tab flex-1 ${activeTab === tab ? "active" : ""}`}
          >
            {tab === "queue"
              ? `Queue · ${songs?.length ?? 0}`
              : tab === "add"
                ? "Add"
                : "Host"}
          </button>
        ))}
      </div>

      {/* ── Tab content panel ──────────────────────────── */}
      <div className="flex-1 min-h-0 bg-[#252525] border border-[#3a3a3a] rounded-b-md overflow-hidden">

        {/* ── Queue ─────────────────────────────────────── */}
        {activeTab === "queue" && (
          <div className="retro-scroll overflow-y-auto max-h-[260px]">
            {!songs || songs.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <span className="retro-lcd-dim text-xs">Empty queue</span>
              </div>
            ) : (
              songs.map((song, index) => {
                const currentVote = voteMap.get(song._id) ?? 0;
                const canRemove = isAdmin || (userId && song.addedBy === userId);
                const isCurrent = song._id === room.currentSongId;
                return (
                  <div
                    key={song._id}
                    className={`retro-track flex items-center gap-2 ${isCurrent ? "!bg-[rgba(51,255,102,0.06)]" : ""}`}
                  >
                    {/* Track number */}
                    <span className={`retro-lcd-dim text-[11px] w-5 text-right shrink-0 ${isCurrent ? "!text-[#33ff66]" : ""}`}>
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] truncate font-medium ${isCurrent ? "text-[#33ff66]" : "text-[#ccc]"}`}
                         style={{ fontFamily: "var(--retro-font-ui)" }}>
                        {song.title}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {song.artist && (
                          <span className="text-[9px] text-[#666] truncate max-w-[45%]"
                                style={{ fontFamily: "var(--retro-font)" }}>
                            {song.artist}
                          </span>
                        )}
                        {song.addedByName && (
                          <span className="text-[9px] text-[#555] truncate"
                                style={{ fontFamily: "var(--retro-font)" }}>
                            · {song.addedByName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Votes */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        className={`retro-vote retro-vote-up ${currentVote === 1 ? "voted" : ""}`}
                        onClick={() => handleVote(song._id, currentVote === 1 ? 0 : 1)}
                        disabled={!userId}
                      >
                        ▲
                      </button>
                      {room.settings.allowDownvotes && (
                        <button
                          className={`retro-vote retro-vote-down ${currentVote === -1 ? "voted" : ""}`}
                          onClick={() => handleVote(song._id, currentVote === -1 ? 0 : -1)}
                          disabled={!userId}
                        >
                          ▼
                        </button>
                      )}
                      <span className={`text-[10px] w-5 text-center ${
                        song.score > 0 ? "text-[#66cc77]" : song.score < 0 ? "text-[#cc6666]" : "text-[#666]"
                      }`} style={{ fontFamily: "var(--retro-font)" }}>
                        {song.score > 0 ? "+" : ""}{song.score}
                      </span>
                      {canRemove && (
                        <button
                          className="retro-vote text-[10px] text-[#666] hover:text-[#cc6666]"
                          style={{ border: "none", background: "none" }}
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

        {/* ── Add Song ─────────────────────────────────── */}
        {activeTab === "add" && (
          <div className="p-3 space-y-3 retro-scroll overflow-y-auto max-h-[260px]">
            {/* Search */}
            <form className="flex gap-1.5" onSubmit={handleSearch}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SEARCH..."
                className="retro-input flex-1 h-7 text-[12px]"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="retro-btn retro-btn-primary px-3 py-1 text-[9px]"
              >
                {isSearching ? "..." : "FIND"}
              </button>
            </form>
            {searchError && (
              <p className="text-[10px] text-[#cc6666]" style={{ fontFamily: "var(--retro-font)" }}>
                {searchError}
              </p>
            )}

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="space-y-1">
                {searchResults.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-2 p-1.5 rounded border border-[#333] hover:border-[#444] transition-colors"
                  >
                    <div className="retro-thumb h-8 w-8 shrink-0">
                      {track.thumbnailUrl && (
                        <img src={track.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-[#ccc] truncate" style={{ fontFamily: "var(--retro-font-ui)" }}>
                        {track.title}
                      </p>
                      <p className="text-[9px] text-[#666] truncate" style={{ fontFamily: "var(--retro-font)" }}>
                        {track.channel}
                      </p>
                    </div>
                    <button
                      className="retro-btn retro-btn-primary px-2 py-0.5 text-[8px]"
                      onClick={() => handleAddFromSearch(track)}
                      disabled={!canAdd || !userId}
                    >
                      {atSongLimit ? "FULL" : "+ ADD"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="retro-groove" />

            {/* Manual add */}
            <form className="space-y-2" onSubmit={handleAddYouTube}>
              <p className="text-[9px] text-[#555] uppercase tracking-wider"
                 style={{ fontFamily: "var(--retro-font-ui)" }}>
                Direct Link
              </p>
              <input
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="YOUTUBE URL OR ID"
                className="retro-input w-full h-7 text-[12px]"
              />
              <input
                value={youtubeTitle}
                onChange={(e) => setYoutubeTitle(e.target.value)}
                placeholder="TRACK TITLE"
                className="retro-input w-full h-7 text-[12px]"
              />
              <input
                value={youtubeArtist}
                onChange={(e) => setYoutubeArtist(e.target.value)}
                placeholder="ARTIST (OPTIONAL)"
                className="retro-input w-full h-7 text-[12px]"
              />
              <button
                type="submit"
                disabled={isAddingYoutube || !canAdd}
                className="retro-btn retro-btn-primary w-full py-1.5 text-[9px]"
              >
                {!canAdd
                  ? atSongLimit ? "LIMIT REACHED" : "GUEST ADD OFF"
                  : isAddingYoutube ? "LOADING..." : "INSERT TRACK"}
              </button>
              {youtubeError && (
                <p className="text-[10px] text-[#cc6666]" style={{ fontFamily: "var(--retro-font)" }}>
                  {youtubeError}
                </p>
              )}
            </form>
          </div>
        )}

        {/* ── Admin / Host controls ────────────────────── */}
        {activeTab === "admin" && isAdmin && (
          <div className="p-3 space-y-3 retro-scroll overflow-y-auto max-h-[260px]">
            <div className="flex items-center gap-1.5">
              <div className="retro-led retro-led-amber" />
              <span className="retro-amber-text text-xs">HOST CONTROLS</span>
            </div>

            {/* Max songs */}
            <div className="space-y-1">
              <p className="text-[9px] text-[#666] uppercase tracking-wider"
                 style={{ fontFamily: "var(--retro-font-ui)" }}>
                Max Songs / User
              </p>
              <div className="flex items-center gap-1.5">
                <input
                  className="retro-input w-16 h-6 text-[12px]"
                  type="number"
                  min={0}
                  placeholder={String(maxSongsPerUser)}
                  value={settingsMaxSongs}
                  onChange={(e) => setSettingsMaxSongs(e.target.value)}
                />
                <button
                  className="retro-btn px-2 py-0.5 text-[8px]"
                  onClick={handleUpdateMaxSongs}
                >
                  SET
                </button>
              </div>
            </div>

            <div className="retro-groove" />

            {/* Transfer Host */}
            <div className="space-y-1">
              <p className="text-[9px] text-[#666] uppercase tracking-wider"
                 style={{ fontFamily: "var(--retro-font-ui)" }}>
                Transfer Host
              </p>
              {contributors.length === 0 ? (
                <p className="text-[10px] text-[#555]" style={{ fontFamily: "var(--retro-font)" }}>
                  No other users yet
                </p>
              ) : (
                <div className="flex items-center gap-1.5">
                  <select
                    className="retro-input flex-1 h-6 text-[11px]"
                    value={transferTarget}
                    onChange={(e) => setTransferTarget(e.target.value)}
                  >
                    <option value="">Select user</option>
                    {contributors.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    className="retro-btn px-2 py-0.5 text-[8px]"
                    onClick={handleTransferHost}
                    disabled={!transferTarget}
                  >
                    GO
                  </button>
                </div>
              )}
            </div>

            <div className="retro-groove" />

            {/* Destroy */}
            <div className="space-y-1">
              <p className="text-[9px] text-[#cc6666] uppercase tracking-wider"
                 style={{ fontFamily: "var(--retro-font-ui)" }}>
                Danger
              </p>
              {confirmDestroy ? (
                <div className="flex items-center gap-1.5">
                  <span className="retro-amber-text text-[10px]">Confirm?</span>
                  <button
                    className="retro-btn retro-btn-danger px-2 py-0.5 text-[8px]"
                    onClick={handleDestroyRoom}
                  >
                    YES
                  </button>
                  <button
                    className="retro-btn px-2 py-0.5 text-[8px]"
                    onClick={() => setConfirmDestroy(false)}
                  >
                    NO
                  </button>
                </div>
              ) : (
                <button
                  className="retro-btn retro-btn-danger px-2 py-0.5 text-[8px]"
                  onClick={() => setConfirmDestroy(true)}
                >
                  DESTROY ROOM
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Error display ──────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-1.5 px-1">
          <div className="retro-led retro-led-red" />
          <p className="text-[10px] text-[#cc6666]" style={{ fontFamily: "var(--retro-font)" }}>
            {error}
          </p>
        </div>
      )}

      {/* ── Bottom bezel ───────────────────────────────── */}
      <div className="flex items-center justify-center pt-0.5">
        <span className="retro-brand">
          powered by synesthesia
        </span>
      </div>
    </div>
  );
}
