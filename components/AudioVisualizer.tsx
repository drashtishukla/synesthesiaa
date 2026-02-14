"use client";

import { useEffect, useMemo, useRef, useCallback } from "react";

type Props = {
  isPlaying: boolean;
  barCount?: number;
  /** 0–1 progress through the current track */
  progress?: number;
  /** Whether the user can click to seek */
  canSeek?: boolean;
  /** Called with a 0–1 fraction when the user clicks to seek */
  onSeek?: (fraction: number) => void;
};

/**
 * A natural-looking audio visualizer drawn on canvas.
 * Uses layered sine waves with varying frequencies/phases so bars
 * move organically — like a real spectrum analyser — instead of
 * all bouncing in sync.
 *
 * When `canSeek` is true and `progress` is provided, a playhead line
 * is drawn and the admin can click anywhere to seek.
 */
export default function AudioVisualizer({
  isPlaying,
  barCount = 56,
  progress = 0,
  canSeek = false,
  onSeek,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const tRef = useRef(0);
  const lastFrameRef = useRef(0);

  // Per-bar random seeds — stable across renders
  const seeds = useMemo(() => {
    return Array.from({ length: barCount }, () => ({
      phase: Math.random() * Math.PI * 2,
      freq1: 1.2 + Math.random() * 1.8,
      freq2: 2.5 + Math.random() * 3.0,
      freq3: 0.3 + Math.random() * 0.5,
      amp1: 0.3 + Math.random() * 0.35,
      amp2: 0.1 + Math.random() * 0.15,
      amp3: 0.15 + Math.random() * 0.2,
    }));
  }, [barCount]);

  // Theme colours in RGB — orange palette
  const colours = useMemo(() => [
    [255, 140, 0],    // primary  — orange
    [255, 180, 50],   // warm amber
    [230, 110, 10],   // deep orange
  ], []);

  // Store latest progress in a ref so the draw loop reads it without re-subscribing
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const canSeekRef = useRef(canSeek);
  canSeekRef.current = canSeek;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = (timestamp: number) => {
      const dt = lastFrameRef.current ? (timestamp - lastFrameRef.current) / 1000 : 0.016;
      lastFrameRef.current = timestamp;

      if (isPlaying) {
        tRef.current += dt;
      }

      const t = tRef.current;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, w, h);

      const gap = 1.5;
      const totalGap = gap * (barCount - 1);
      const barW = Math.max(1.5, (w - totalGap) / barCount);
      const center = barCount / 2;

      for (let i = 0; i < barCount; i++) {
        const s = seeds[i];

        const dist = Math.abs(i - center) / center;
        const envelope = 1 - dist * 0.55;

        let normH: number;
        if (isPlaying) {
          const wave1 = Math.sin(t * s.freq1 + s.phase) * s.amp1;
          const wave2 = Math.sin(t * s.freq2 + s.phase * 1.7) * s.amp2;
          const wave3 = Math.sin(t * s.freq3 + s.phase * 0.3) * s.amp3;
          const raw = 0.35 + wave1 + wave2 + wave3;
          normH = Math.max(0.06, Math.min(1, raw)) * envelope;
        } else {
          normH = 0.04 * envelope;
        }

        const barH = normH * h;
        const x = i * (barW + gap);
        const y = h - barH;

        const col = colours[i % 3];
        const alpha = isPlaying ? 0.55 + normH * 0.45 : 0.2;
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
        ctx.fillRect(x, y, barW, barH);

        if (isPlaying && barH > 3) {
          const tipH = Math.min(2.5, barH * 0.15);
          ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha + 0.3})`;
          ctx.fillRect(x, y, barW, tipH);
        }
      }

      // Draw playhead line if canSeek
      if (canSeekRef.current && isPlaying) {
        const px = progressRef.current * w;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Small dot at top
        ctx.beginPath();
        ctx.arc(px, 2, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "hsl(24,100%,50%)";
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, barCount, seeds, colours]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canSeek || !onSeek) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek(fraction);
    },
    [canSeek, onSeek],
  );

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-10 ${canSeek ? "cursor-pointer" : ""}`}
      style={{ display: "block" }}
      onClick={handleClick}
      title={canSeek ? "Click to seek" : undefined}
    />
  );
}
