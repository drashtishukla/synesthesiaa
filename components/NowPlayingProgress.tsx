"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type YTPlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
};

type Props = {
  /** The YouTube player instance (from react-youtube onReady) */
  player: YTPlayer | null;
};

export default function NowPlayingProgress({ player }: Props) {
  const [progress, setProgress] = useState(0); // 0-1
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const rafRef = useRef<number>(0);

  const tick = useCallback(() => {
    if (!player) return;
    try {
      const cur = player.getCurrentTime?.() ?? 0;
      const dur = player.getDuration?.() ?? 0;
      setCurrentTime(cur);
      setDuration(dur);
      setProgress(dur > 0 ? cur / dur : 0);
    } catch {
      // player might not be ready
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [player]);

  useEffect(() => {
    if (!player) return;
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [player, tick]);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!player || duration === 0) return null;

  return (
    <div className="space-y-1">
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-200"
          style={{ width: `${(progress * 100).toFixed(1)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{fmt(currentTime)}</span>
        <span>{fmt(duration)}</span>
      </div>
    </div>
  );
}
