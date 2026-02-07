"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUserId } from "@/app/lib/useUserId";

type RoomPageProps = {
  params: { code: string };
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

  const voteMap = useMemo(() => {
    const map = new Map<string, number>();
    votes?.forEach((vote) => {
      map.set(vote.songId, vote.value);
    });
    return map;
  }, [votes]);

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
      <main>
        <section className="card">Loading room...</section>
      </main>
    );
  }

  if (room === null) {
    return (
      <main>
        <section className="card stack">
          <h1>Room not found</h1>
          <p>Double-check the room code and try again.</p>
          <Link className="button" href="/">
            Back home
          </Link>
        </section>
      </main>
    );
  }

  const allowGuestAdd = room.settings.allowGuestAdd;

  return (
    <main>
      <section className="card stack tight">
        <h1>{room.name}</h1>
        <p className="muted">
          Room code <strong>{room.code}</strong>
        </p>
        <div className="pill-row">
          <span className="pill">Queue size: {songs?.length ?? 0}</span>
          <span className="pill">
            Downvotes {room.settings.allowDownvotes ? "on" : "off"}
          </span>
        </div>
      </section>

      <section className="grid">
        <form className="card stack" onSubmit={handleAddSong}>
          <h2>Add a song</h2>
          <label className="stack tight">
            Title
            <input
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Song title"
            />
          </label>
          <label className="stack tight">
            Artist
            <input
              className="input"
              value={artist}
              onChange={(event) => setArtist(event.target.value)}
              placeholder="Optional"
            />
          </label>
          <button
            className="button primary"
            type="submit"
            disabled={isAdding || !allowGuestAdd}
          >
            {allowGuestAdd
              ? isAdding
                ? "Adding..."
                : "Add to queue"
              : "Guest add disabled"}
          </button>
        </form>

        <section className="card stack">
          <h2>Queue</h2>
          {!songs || songs.length === 0 ? (
            <p className="muted">No songs yet. Add the first track.</p>
          ) : (
            <div className="stack">
              {songs.map((song, index) => {
                const currentVote = voteMap.get(song._id) ?? 0;
                return (
                  <div key={song._id} className="queue-item">
                    <div>
                      <p className="queue-title">
                        {index + 1}. {song.title}
                      </p>
                      {song.artist ? (
                        <p className="muted">{song.artist}</p>
                      ) : null}
                    </div>
                    <div className="vote-box">
                      <button
                        className={`button tiny ${
                          currentVote === 1 ? "active" : ""
                        }`}
                        onClick={() =>
                          handleVote(song._id, currentVote === 1 ? 0 : 1)
                        }
                        type="button"
                        disabled={!userId}
                      >
                        +1
                      </button>
                      {room.settings.allowDownvotes ? (
                        <button
                          className={`button tiny ${
                            currentVote === -1 ? "active" : ""
                          }`}
                          onClick={() =>
                            handleVote(song._id, currentVote === -1 ? 0 : -1)
                          }
                          type="button"
                          disabled={!userId}
                        >
                          -1
                        </button>
                      ) : null}
                      <span className="score">{song.score}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </section>

      {error ? (
        <section className="card warning">
          <p>{error}</p>
        </section>
      ) : null}

      <section className="card stack tight">
        <h2>Playback</h2>
        <p className="muted">
          Synesthesia does not stream music. A host device should read the queue
          and play tracks on Spotify Connect, YouTube, or another provider.
        </p>
      </section>
    </main>
  );
}
