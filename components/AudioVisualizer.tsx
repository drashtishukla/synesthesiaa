"use client";

import { useEffect, useMemo, useRef } from "react";

type Props = {
  isPlaying: boolean;
  barCount?: number;
};

/**
 * A natural-looking audio visualizer drawn on canvas.
 * Uses layered sine waves with varying frequencies/phases so bars
 * move organically — like a real spectrum analyser — instead of
 * all bouncing in sync.
 */
export default function AudioVisualizer({ isPlaying, barCount = 56 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const tRef = useRef(0);
  const lastFrameRef = useRef(0);

  // Per-bar random seeds — stable across renders
  const seeds = useMemo(() => {
    return Array.from({ length: barCount }, () => ({
      phase: Math.random() * Math.PI * 2,
      freq1: 1.2 + Math.random() * 1.8,   // primary wave speed
      freq2: 2.5 + Math.random() * 3.0,   // secondary fast ripple
      freq3: 0.3 + Math.random() * 0.5,   // slow swell
      amp1: 0.3 + Math.random() * 0.35,
      amp2: 0.1 + Math.random() * 0.15,
      amp3: 0.15 + Math.random() * 0.2,
    }));
  }, [barCount]);

  // Theme colours in RGB
  const colours = useMemo(() => [
    [229, 57, 53],    // primary  — red
    [100, 181, 246],  // accent   — blue
    [104, 159, 56],   // secondary — green
  ], []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = (timestamp: number) => {
      // Delta time in seconds
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

        // Envelope: centre bars taller
        const dist = Math.abs(i - center) / center;
        const envelope = 1 - dist * 0.55;

        let normH: number;
        if (isPlaying) {
          // Combine 3 sine waves at different frequencies for organic motion
          const wave1 = Math.sin(t * s.freq1 + s.phase) * s.amp1;
          const wave2 = Math.sin(t * s.freq2 + s.phase * 1.7) * s.amp2;
          const wave3 = Math.sin(t * s.freq3 + s.phase * 0.3) * s.amp3;
          const raw = 0.35 + wave1 + wave2 + wave3;
          normH = Math.max(0.06, Math.min(1, raw)) * envelope;
        } else {
          // Idle: tiny bars
          normH = 0.04 * envelope;
        }

        const barH = normH * h;
        const x = i * (barW + gap);
        const y = h - barH;

        // Pick colour
        const col = colours[i % 3];
        const alpha = isPlaying ? 0.55 + normH * 0.45 : 0.2;
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
        ctx.fillRect(x, y, barW, barH);

        // Brighter tip
        if (isPlaying && barH > 3) {
          const tipH = Math.min(2.5, barH * 0.15);
          ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha + 0.3})`;
          ctx.fillRect(x, y, barW, tipH);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, barCount, seeds, colours]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-10"
      style={{ display: "block" }}
    />
  );
}
