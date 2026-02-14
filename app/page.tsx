"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { api } from "@/convex/_generated/api";
import { useUserId } from "@/app/lib/useUserId";

export default function Home() {
  const router = useRouter();
  const userId = useUserId();
  const createRoom = useMutation(api.rooms.createRoom);

  const [roomName, setRoomName] = useState("");
  const [maxSongsPerUser, setMaxSongsPerUser] = useState(5);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [leftPlaying, setLeftPlaying] = useState(true);
  const [rightPlaying, setRightPlaying] = useState(true);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) {
      setError("Generating a user id. Try again in a second.");
      return;
    }
    setError(null);
    setIsCreating(true);
    try {
      const name = roomName.trim() || "Untitled Room";
      const result = await createRoom({ name, hostUserId: userId, maxSongsPerUser });
      router.push(`/room/${result.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create room.");
      setIsCreating(false);
    }
  };

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError("Enter a room code to join.");
      return;
    }
    setError(null);
    router.push(`/room/${code}`);
  };

  return (
    <main className="min-h-screen relative">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.06] blur-[160px]" />
      </div>

      {/* Vinyl Discs — tech-futuristic style */}
      <div className="fixed inset-0 overflow-hidden z-0">
        {/* ── Left vinyl + tonearm ── */}
        <div className="absolute -left-[100px] top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            className="w-[420px] h-[420px] opacity-[0.35] animate-[spin_22s_linear_infinite]"
            viewBox="0 0 300 300"
            style={{ animationPlayState: leftPlaying ? 'running' : 'paused' }}
          >
            <circle cx="150" cy="150" r="148" fill="#161616" stroke="#2a2a2a" strokeWidth="1.5" />
            <circle cx="150" cy="150" r="140" fill="#1a1a1a" stroke="#252525" strokeWidth="0.6" />
            <circle cx="150" cy="150" r="130" fill="none" stroke="#222" strokeWidth="0.4" />
            <circle cx="150" cy="150" r="120" fill="none" stroke="#1f1f1f" strokeWidth="0.3" />
            <circle cx="150" cy="150" r="110" fill="none" stroke="#222" strokeWidth="0.4" />
            <circle cx="150" cy="150" r="100" fill="none" stroke="#1f1f1f" strokeWidth="0.3" />
            <circle cx="150" cy="150" r="90" fill="none" stroke="#222" strokeWidth="0.4" />
            <circle cx="150" cy="150" r="80" fill="none" stroke="#1f1f1f" strokeWidth="0.3" />
            <circle cx="150" cy="150" r="70" fill="none" stroke="#222" strokeWidth="0.4" />
            <circle cx="150" cy="150" r="55" fill="none" stroke="hsl(24,100%,50%)" strokeWidth="0.8" opacity="0.6" />
            {Array.from({ length: 36 }).map((_, i) => {
              const a = (i * 10) * Math.PI / 180;
              return <line key={i} x1={150 + Math.cos(a) * 38} y1={150 + Math.sin(a) * 38} x2={150 + Math.cos(a) * 52} y2={150 + Math.sin(a) * 52} stroke="hsl(24,100%,50%)" strokeWidth="1.4" opacity="0.7" strokeLinecap="round" />;
            })}
            <circle cx="150" cy="150" r="32" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="0.6" />
            <circle cx="150" cy="150" r="20" fill="#161616" stroke="hsl(24,100%,50%)" strokeWidth="0.5" opacity="0.5" />
            <circle cx="150" cy="150" r="6" fill="hsl(24,100%,50%)" opacity="0.9" />
            <circle cx="150" cy="150" r="2.5" fill="#111" />
            <polygon points="150,5 146,14 154,14" fill="hsl(24,100%,50%)" opacity="0.6" />
            <polygon points="295,150 286,146 286,154" fill="hsl(24,100%,50%)" opacity="0.6" />
            <polygon points="150,295 154,286 146,286" fill="hsl(24,100%,50%)" opacity="0.6" />
            <polygon points="5,150 14,154 14,146" fill="hsl(24,100%,50%)" opacity="0.6" />
          </svg>
          {/* Interactive tonearm — left */}
          <svg
            className="absolute -top-6 left-[58%] w-[140px] h-[220px] opacity-[0.35] cursor-pointer pointer-events-auto hover:opacity-[0.55]"
            viewBox="0 0 100 170"
            fill="none"
            onClick={() => setLeftPlaying(p => !p)}
            style={{
              transformOrigin: '50% 12px',
              transform: leftPlaying ? 'rotate(0deg)' : 'rotate(-30deg)',
              transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s',
            }}
          >
            <circle cx="50" cy="12" r="10" fill="#1a1a1a" stroke="#333" strokeWidth="1" />
            <circle cx="50" cy="12" r="4" fill="#333" />
            <circle cx="50" cy="12" r="1.5" fill="hsl(24,100%,50%)" opacity="0.7" />
            <line x1="50" y1="22" x2="38" y2="130" stroke="#2a2a2a" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="49" y1="26" x2="39" y2="120" stroke="hsl(24,100%,50%)" strokeWidth="0.7" opacity="0.4" />
            <rect x="33" y="128" width="10" height="18" rx="2" fill="#222" stroke="#333" strokeWidth="0.8" />
            <line x1="38" y1="146" x2="38" y2="156" stroke="hsl(24,100%,50%)" strokeWidth="1.2" opacity="0.6" strokeLinecap="round" />
          </svg>
        </div>

        {/* ── Right vinyl + tonearm (mirrored) ── */}
        <div className="absolute -right-[100px] top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            className="w-[420px] h-[420px] opacity-[0.35] animate-[spin_22s_linear_infinite_reverse]"
            viewBox="0 0 300 300"
            style={{ animationPlayState: rightPlaying ? 'running' : 'paused' }}
          >
            <circle cx="150" cy="150" r="148" fill="#161616" stroke="#2a2a2a" strokeWidth="1.5" />
            <circle cx="150" cy="150" r="140" fill="#1a1a1a" stroke="#252525" strokeWidth="0.6" />
            <circle cx="150" cy="150" r="130" fill="none" stroke="#222" strokeWidth="0.4" />
            <circle cx="150" cy="150" r="120" fill="none" stroke="#1f1f1f" strokeWidth="0.3" />
            <circle cx="150" cy="150" r="110" fill="none" stroke="#222" strokeWidth="0.4" />
            <circle cx="150" cy="150" r="100" fill="none" stroke="#1f1f1f" strokeWidth="0.3" />
            <circle cx="150" cy="150" r="90" fill="none" stroke="#222" strokeWidth="0.4" />
            <circle cx="150" cy="150" r="80" fill="none" stroke="#1f1f1f" strokeWidth="0.3" />
            <circle cx="150" cy="150" r="70" fill="none" stroke="#222" strokeWidth="0.4" />
            <circle cx="150" cy="150" r="55" fill="none" stroke="hsl(24,100%,50%)" strokeWidth="0.8" opacity="0.6" />
            {Array.from({ length: 36 }).map((_, i) => {
              const a = (i * 10) * Math.PI / 180;
              return <line key={i} x1={150 + Math.cos(a) * 38} y1={150 + Math.sin(a) * 38} x2={150 + Math.cos(a) * 52} y2={150 + Math.sin(a) * 52} stroke="hsl(24,100%,50%)" strokeWidth="1.4" opacity="0.7" strokeLinecap="round" />;
            })}
            <circle cx="150" cy="150" r="32" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="0.6" />
            <circle cx="150" cy="150" r="20" fill="#161616" stroke="hsl(24,100%,50%)" strokeWidth="0.5" opacity="0.5" />
            <circle cx="150" cy="150" r="6" fill="hsl(24,100%,50%)" opacity="0.9" />
            <circle cx="150" cy="150" r="2.5" fill="#111" />
            <polygon points="150,5 146,14 154,14" fill="hsl(24,100%,50%)" opacity="0.6" />
            <polygon points="295,150 286,146 286,154" fill="hsl(24,100%,50%)" opacity="0.6" />
            <polygon points="150,295 154,286 146,286" fill="hsl(24,100%,50%)" opacity="0.6" />
            <polygon points="5,150 14,154 14,146" fill="hsl(24,100%,50%)" opacity="0.6" />
          </svg>
          {/* Interactive tonearm — right (mirrored) */}
          <svg
            className="absolute -top-6 right-[58%] w-[140px] h-[220px] opacity-[0.35] -scale-x-100 cursor-pointer pointer-events-auto hover:opacity-[0.55]"
            viewBox="0 0 100 170"
            fill="none"
            onClick={() => setRightPlaying(p => !p)}
            style={{
              transformOrigin: '50% 12px',
              transform: `scaleX(-1) rotate(${rightPlaying ? '0' : '-30'}deg)`,
              transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s',
            }}
          >
            <circle cx="50" cy="12" r="10" fill="#1a1a1a" stroke="#333" strokeWidth="1" />
            <circle cx="50" cy="12" r="4" fill="#333" />
            <circle cx="50" cy="12" r="1.5" fill="hsl(24,100%,50%)" opacity="0.7" />
            <line x1="50" y1="22" x2="38" y2="130" stroke="#2a2a2a" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="49" y1="26" x2="39" y2="120" stroke="hsl(24,100%,50%)" strokeWidth="0.7" opacity="0.4" />
            <rect x="33" y="128" width="10" height="18" rx="2" fill="#222" stroke="#333" strokeWidth="0.8" />
            <line x1="38" y1="146" x2="38" y2="156" stroke="hsl(24,100%,50%)" strokeWidth="1.2" opacity="0.6" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <div className="relative z-10 container flex flex-col gap-10 py-16 sm:py-20">
        {/* Hero */}
        <section className="max-w-2xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-widest">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            Live crowd queue
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-glow">
            Let the room choose what plays next.
          </h1>

          <p className="max-w-lg mx-auto text-base text-muted-foreground leading-relaxed">
            Synesthesia is a real-time music queue where guests vote tracks
            up or down. The playlist reacts instantly, keeping the vibe
            democratic and alive.
          </p>

          <div className="flex justify-center gap-3">
            {["Realtime backend", "Vote-based ordering", "YouTube playback"].map(
              (label) => (
                <span
                  key={label}
                  className="px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-white/[0.04] border border-white/[0.08] text-white/40"
                >
                  {label}
                </span>
              ),
            )}
          </div>
        </section>

        {/* Cards Grid */}
        <section className="grid gap-5 lg:grid-cols-2 max-w-3xl mx-auto w-full">
          {/* Create Room */}
          <div className="rounded-3xl bg-card border border-white/[0.06] p-6 sm:p-7 space-y-5 shadow-glow">
            <div>
              <h2 className="text-lg font-bold mb-1">Start a room</h2>
              <p className="text-sm text-muted-foreground">
                Kick off a session and share the code.
              </p>
            </div>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="space-y-2">
                <label htmlFor="room-name" className="text-xs font-medium text-white/50">
                  Room name
                </label>
                <input
                  id="room-name"
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  placeholder="House Party, Cafe, Campus Fest"
                  className="w-full h-11 rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="max-songs" className="text-xs font-medium text-white/50">
                  Songs per user (0 = unlimited)
                </label>
                <input
                  id="max-songs"
                  type="number"
                  min={0}
                  value={maxSongsPerUser}
                  onChange={(event) =>
                    setMaxSongsPerUser(Number(event.target.value))
                  }
                  className="w-full h-11 rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={isCreating}
                className="w-full h-11 rounded-2xl bg-primary hover:bg-primary/85 disabled:bg-white/[0.04] disabled:text-white/20 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-primary/20"
              >
                {isCreating ? "Creating..." : "Create room"}
              </button>
            </form>
          </div>

          {/* Join Room */}
          <div className="rounded-3xl bg-card border border-white/[0.06] p-6 sm:p-7 space-y-5">
            <div>
              <h2 className="text-lg font-bold mb-1">Join a room</h2>
              <p className="text-sm text-muted-foreground">
                Enter the room code to add songs and vote.
              </p>
            </div>
            <form className="space-y-4" onSubmit={handleJoin}>
              <div className="space-y-2">
                <label htmlFor="room-code" className="text-xs font-medium text-white/50">
                  Room code
                </label>
                <input
                  id="room-code"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  placeholder="ABC123"
                  className="w-full h-11 rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors uppercase tracking-widest"
                />
              </div>
              <button
                type="submit"
                className="w-full h-11 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/70 font-semibold text-sm transition-all duration-200"
              >
                Join room
              </button>
            </form>
          </div>
        </section>

        {/* Error */}
        {error ? (
          <div className="max-w-3xl mx-auto w-full rounded-2xl bg-destructive/10 border border-destructive/20 px-5 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {/* How it works */}
        <section className="grid gap-4 lg:grid-cols-3 max-w-3xl mx-auto w-full">
          {[
            {
              title: "Create",
              description:
                "Spin up a room in seconds. The host keeps playback on their device.",
            },
            {
              title: "Vote",
              description:
                "Guests add songs and vote to shape the vibe in real time.",
            },
            {
              title: "Play",
              description:
                "Queue order updates instantly so the next track is always crowd-approved.",
            },
          ].map((step) => (
            <div
              key={step.title}
              className="rounded-2xl bg-card/50 border border-white/[0.04] p-5"
            >
              <h3 className="font-bold text-sm mb-1.5 text-white/80">{step.title}</h3>
              <p className="text-xs text-white/30 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </section>

        {/* ── Embed & Integrate ─────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto w-full space-y-10 pt-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Add to your project
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Embed the Synesthesia widget in any website, app, or stream overlay with a single line of code.
            </p>
          </div>

          {/* Embed Widget */}
          <div className="rounded-3xl bg-card border border-white/[0.06] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Embed Widget</span>
              </div>
              <span className="text-[10px] text-white/30 font-mono">iframe</span>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Drop this snippet into your HTML. The widget opens a lobby where users can create or join rooms — no room code needed in the embed itself.
              </p>
              <div className="relative group">
                <pre className="rounded-2xl bg-black/40 border border-white/[0.06] p-4 overflow-x-auto text-xs font-mono text-white/70 leading-relaxed">
{`<iframe
  src="${typeof window !== "undefined" ? window.location.origin : "https://yourdomain.com"}/embed"
  width="420"
  height="600"
  frameborder="0"
  allow="autoplay; encrypted-media"
  style="border-radius: 16px; border: none;"
></iframe>`}
                </pre>
                <button
                  type="button"
                  onClick={() => {
                    const origin = typeof window !== "undefined" ? window.location.origin : "https://yourdomain.com";
                    navigator.clipboard.writeText(`<iframe\n  src="${origin}/embed"\n  width="420"\n  height="600"\n  frameborder="0"\n  allow="autoplay; encrypted-media"\n  style="border-radius: 16px; border: none;"\n></iframe>`);
                  }}
                  className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-primary/20 border border-white/[0.08] hover:border-primary/30 text-[10px] text-white/40 hover:text-primary font-medium opacity-0 group-hover:opacity-100 transition-all duration-200"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-white/30 leading-relaxed">
                To auto-join a specific room, append <code className="text-primary font-mono">?room=ABCD</code> to the embed URL.
              </p>
            </div>
          </div>

          {/* JS / REST API */}
          <div className="rounded-3xl bg-card border border-white/[0.06] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white/60">JavaScript API</span>
              </div>
              <span className="text-[10px] text-white/30 font-mono">fetch</span>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Interact with rooms programmatically. Create rooms, add songs, and listen for queue updates via the Convex API.
              </p>
              <div className="relative group">
                <pre className="rounded-2xl bg-black/40 border border-white/[0.06] p-4 overflow-x-auto text-xs font-mono text-white/70 leading-relaxed">
{`import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api";

const client = new ConvexHttpClient(
  process.env.NEXT_PUBLIC_CONVEX_URL
);

// Create a room
const { code } = await client.mutation(
  api.rooms.createRoom,
  { name: "My Room", hostUserId: "host_1", maxSongsPerUser: 5 }
);

// Add a song to the queue
await client.mutation(api.songs.addSong, {
  roomId,
  title: "Never Gonna Give You Up",
  providerId: "dQw4w9WgXcQ",
  provider: "youtube",
  addedBy: "user_123",
  addedByName: "Guest",
});`}
                </pre>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`import { ConvexHttpClient } from "convex/browser";\nimport { api } from "./convex/_generated/api";\n\nconst client = new ConvexHttpClient(\n  process.env.NEXT_PUBLIC_CONVEX_URL\n);\n\n// Create a room\nconst { code } = await client.mutation(\n  api.rooms.createRoom,\n  { name: "My Room", hostUserId: "host_1", maxSongsPerUser: 5 }\n);\n\n// Add a song to the queue\nawait client.mutation(api.songs.addSong, {\n  roomId,\n  title: "Never Gonna Give You Up",\n  providerId: "dQw4w9WgXcQ",\n  provider: "youtube",\n  addedBy: "user_123",\n  addedByName: "Guest",\n});`);
                  }}
                  className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-primary/20 border border-white/[0.08] hover:border-primary/30 text-[10px] text-white/40 hover:text-primary font-medium opacity-0 group-hover:opacity-100 transition-all duration-200"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

          {/* Quick Start */}
          <div className="rounded-3xl bg-card border border-white/[0.06] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Quick Start</span>
              </div>
              <span className="text-[10px] text-white/30 font-mono">terminal</span>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Self-host Synesthesia in under a minute. Clone, configure, and launch.
              </p>
              <div className="relative group">
                <pre className="rounded-2xl bg-black/40 border border-white/[0.06] p-4 overflow-x-auto text-xs font-mono text-white/70 leading-relaxed">
{`# Clone the repo
git clone https://github.com/ACM-VIT/synesthesia.git
cd synesthesia

# Install dependencies
pnpm install

# Set up Convex (backend)
npx convex dev

# Start the dev server
pnpm dev

# Open http://localhost:3000`}
                </pre>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`git clone https://github.com/ACM-VIT/synesthesia.git\ncd synesthesia\npnpm install\nnpx convex dev\npnpm dev`);
                  }}
                  className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-primary/20 border border-white/[0.08] hover:border-primary/30 text-[10px] text-white/40 hover:text-primary font-medium opacity-0 group-hover:opacity-100 transition-all duration-200"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

          {/* Feature table */}
          <div className="rounded-3xl bg-card border border-white/[0.06] overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Embed Options</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Parameter</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Type</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {[
                    { param: "room", type: "string", desc: "Room code to auto-join on load" },
                    { param: "theme", type: "dark | light", desc: "Override widget color scheme" },
                    { param: "compact", type: "boolean", desc: "Minimal mode — hides queue list" },
                    { param: "autoplay", type: "boolean", desc: "Start playback automatically" },
                  ].map((row) => (
                    <tr key={row.param} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 font-mono text-primary text-xs">{row.param}</td>
                      <td className="px-5 py-3 text-white/40 text-xs font-mono">{row.type}</td>
                      <td className="px-5 py-3 text-white/60 text-xs">{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="max-w-3xl mx-auto w-full text-center py-10">
          <p className="text-xs text-white/20">
            Built by{" "}
            <a href="https://acmvit.in" target="_blank" rel="noopener noreferrer" className="text-primary/60 hover:text-primary transition-colors">
              ACM-VIT
            </a>
            {" "}· Powered by{" "}
            <a href="https://convex.dev" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/50 transition-colors">
              Convex
            </a>
            {" "}&{" "}
            <a href="https://nextjs.org" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/50 transition-colors">
              Next.js
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
