"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

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
    <main className="min-h-screen">
      <div className="container flex flex-col gap-12 py-16">
        <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-7">
            <Badge variant="secondary">Live crowd queue</Badge>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold text-glow sm:text-5xl lg:text-6xl">
                Let the room choose what plays next.
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                Synesthesia is a real-time music queue where guests vote tracks
                up or down. The playlist reacts instantly, keeping the vibe
                democratic and alive.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                "Convex realtime backend",
                "Vote-based ordering",
                "YouTube playback",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <Card className="relative overflow-hidden border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-2xl">Live room snapshot</CardTitle>
              <CardDescription>
                A quick glimpse of the queue experience.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { title: "Afterglow", artist: "Hayden James", score: 9 },
                { title: "City Lights", artist: "MUNA", score: 7 },
                { title: "Bloom", artist: "ODESZA", score: 5 },
              ].map((song) => (
                <div
                  key={song.title}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">{song.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {song.artist}
                    </p>
                  </div>
                  <Badge>{song.score}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle>Start a room</CardTitle>
              <CardDescription>
                Kick off a session and share the code with friends.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreate}>
                <div className="space-y-2">
                  <Label htmlFor="room-name">Room name</Label>
                  <Input
                    id="room-name"
                    value={roomName}
                    onChange={(event) => setRoomName(event.target.value)}
                    placeholder="House Party, Cafe, Campus Fest"
                  />
                </div>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Creating..." : "Create room"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-secondary/20 bg-secondary/5">
            <CardHeader>
              <CardTitle>Join a room</CardTitle>
              <CardDescription>
                Enter the room code to add songs and vote.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleJoin}>
                <div className="space-y-2">
                  <Label htmlFor="room-code">Room code</Label>
                  <Input
                    id="room-code"
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value)}
                    placeholder="ABC123"
                  />
                </div>
                <Button type="submit" variant="outline">
                  Join room
                </Button>
              </form>
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

        <section className="grid gap-6 lg:grid-cols-3">
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
            <Card key={step.title} className="border-white/5">
              <CardHeader>
                <CardTitle>{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
