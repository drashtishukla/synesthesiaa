"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const EMOJI_OPTIONS = ["🔥", "❤️", "🎵", "👏", "😍", "🤘", "💯", "🎶"];
const REACTION_WINDOW_MS = 8_000;
const FLOAT_DURATION_MS = 3_000;

type FloatingEmoji = {
  id: string;
  emoji: string;
  x: number;
  createdAt: number;
};

/**
 * Renders two parts:
 *  1. A floating-emoji overlay (pointer-events-none, absolute) that should
 *     cover a parent with `position: relative`.
 *  2. An emoji-picker bar the user clicks to send reactions.
 *
 * Usage: wrap the video element and this component in a shared `relative`
 * container so the floating emojis appear over the video.
 */
export default function ReactionOverlay({
  roomId,
  userId,
}: {
  roomId: Id<"rooms">;
  userId: string | null;
}) {
  const sendReaction = useMutation(api.reactions.sendReaction);

  const [sinceBase, setSinceBase] = useState(() => Date.now() - REACTION_WINDOW_MS);
  useEffect(() => {
    const interval = setInterval(() => {
      setSinceBase(Date.now() - REACTION_WINDOW_MS);
    }, 4_000);
    return () => clearInterval(interval);
  }, []);

  const reactions = useQuery(api.reactions.recentReactions, {
    roomId,
    since: sinceBase,
  });

  const seenRef = useRef(new Set<string>());
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);

  useEffect(() => {
    if (!reactions) return;
    const newOnes: FloatingEmoji[] = [];
    for (const r of reactions) {
      if (!seenRef.current.has(r._id)) {
        seenRef.current.add(r._id);
        newOnes.push({
          id: r._id,
          emoji: r.emoji,
          x: 10 + Math.random() * 80,
          createdAt: r.createdAt,
        });
      }
    }
    if (newOnes.length > 0) {
      setFloatingEmojis((prev) => [...prev, ...newOnes]);
    }
  }, [reactions]);

  // Prune expired emojis
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - FLOAT_DURATION_MS;
      setFloatingEmojis((prev) => prev.filter((e) => e.createdAt > cutoff));
    }, 1_000);
    return () => clearInterval(interval);
  }, []);

  const lastSentRef = useRef(0);
  const COOLDOWN_MS = 500;

  const handleSend = async (emoji: string) => {
    if (!userId) return;
    const now = Date.now();
    if (now - lastSentRef.current < COOLDOWN_MS) return; // client-side throttle
    lastSentRef.current = now;
    try {
      await sendReaction({ roomId, userId, emoji });
    } catch {
      // silently ignore
    }
  };

  return (
    <>
      {/* Floating emojis – covers the nearest `position: relative` ancestor */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
        {floatingEmojis.map((fe) => (
          <span
            key={fe.id}
            className="absolute animate-float-up text-2xl sm:text-3xl select-none"
            style={{
              left: `${fe.x}%`,
              bottom: 0,
            }}
          >
            {fe.emoji}
          </span>
        ))}
      </div>

      {/* Emoji picker bar – rendered in normal flow below the video */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 mt-3">
        {EMOJI_OPTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleSend(emoji)}
            disabled={!userId}
            className="rounded-xl px-2 py-1 text-xl transition-transform hover:scale-125 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}
