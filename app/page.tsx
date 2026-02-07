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
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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
      const result = await createRoom({ name, hostUserId: userId });
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
    <main>
      <section className="card stack">
        <div className="stack tight">
          <h1>Synesthesia</h1>
          <p>
            Real-time, crowd-controlled music queues. Guests add songs and vote.
            The playlist updates instantly for everyone in the room.
          </p>
        </div>
        <div className="pill-row">
          <span className="pill">Convex live backend</span>
          <span className="pill">Next.js App Router</span>
          <span className="pill">Crowd voting</span>
        </div>
      </section>

      <section className="grid">
        <form className="card stack" onSubmit={handleCreate}>
          <h2>Start a Room</h2>
          <label className="stack tight">
            Room name
            <input
              className="input"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder="House Party, Cafe, Campus Fest"
            />
          </label>
          <button className="button primary" type="submit" disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Room"}
          </button>
        </form>

        <form className="card stack" onSubmit={handleJoin}>
          <h2>Join a Room</h2>
          <label className="stack tight">
            Room code
            <input
              className="input"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="ABC123"
            />
          </label>
          <button className="button" type="submit">
            Join Room
          </button>
        </form>
      </section>

      {error ? (
        <section className="card warning">
          <p>{error}</p>
        </section>
      ) : null}

      <section className="card stack tight">
        <h2>How it works</h2>
        <p>
          Hosts run playback on their device. Synesthesia decides what plays
          next based on live votes, not a DJ.
        </p>
      </section>
    </main>
  );
}
