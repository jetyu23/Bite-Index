"use client";

import { useEffect, useRef } from "react";

/* A hydrographic-chart background: drifting depth-contour lines with sparse
   sounding labels. The contours nearest the pointer pick up the teal accent,
   like a torch over a chart table. Deliberately quiet — it must never compete
   with the data. Respects prefers-reduced-motion (no ambient drift), pauses
   when the tab is hidden, and does a slow drift instead of pointer tracking
   on touch devices. */

const LINE = { r: 22, g: 35, b: 43 };   // --ink
const TEAL = { r: 15, g: 110, b: 115 }; // --teal
const BASE_ALPHA = 0.075;
const GLOW_ALPHA = 0.22;
const GLOW_RADIUS = 220;
const SPACING = 58;
const STEP = 12;

export default function ChartBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let phase = Math.random() * 100;
    let px = -9999;
    let py = -9999;
    let raf = 0;
    let running = true;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const yAt = (x: number, baseY: number, i: number) =>
      baseY +
      Math.sin(x * 0.006 + phase + i * 1.7) * 10 +
      Math.sin(x * 0.0017 + phase * 0.6 + i * 0.9) * 16;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const lines = Math.ceil(h / SPACING) + 2;
      for (let i = 0; i < lines; i++) {
        const baseY = i * SPACING - 20;
        let prevX = 0;
        let prevY = yAt(0, baseY, i);
        for (let x = STEP; x <= w + STEP; x += STEP) {
          const yy = yAt(x, baseY, i);
          const mx = (x + prevX) / 2;
          const my = (yy + prevY) / 2;
          const d = Math.hypot(mx - px, my - py);
          const glow = d < GLOW_RADIUS ? (1 - d / GLOW_RADIUS) ** 2 : 0;
          const a = BASE_ALPHA + glow * GLOW_ALPHA;
          const r = LINE.r + (TEAL.r - LINE.r) * glow;
          const g = LINE.g + (TEAL.g - LINE.g) * glow;
          const b = LINE.b + (TEAL.b - LINE.b) * glow;
          ctx.strokeStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(x, yy);
          ctx.stroke();
          prevX = x;
          prevY = yy;
        }
        // sparse sounding labels, chart-style
        if (i % 4 === 2) {
          ctx.fillStyle = `rgba(${LINE.r},${LINE.g},${LINE.b},${BASE_ALPHA * 1.6})`;
          ctx.font = "10px 'IBM Plex Mono', monospace";
          ctx.fillText(`${i * 3 + 6}`, 14, yAt(14, baseY, i) - 4);
        }
      }
    };

    const loop = () => {
      if (!running) return;
      if (!reduced) phase += 0.0016;
      draw();
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (reduced) draw(); // no rAF loop in reduced mode; redraw on demand
    };
    const onLeave = () => {
      px = -9999;
      py = -9999;
      if (reduced) draw();
    };
    const onVis = () => {
      running = !document.hidden;
      if (running && !reduced) raf = requestAnimationFrame(loop);
      else cancelAnimationFrame(raf);
    };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    if (finePointer) {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerleave", onLeave);
    }
    if (!reduced) raf = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} className="chart-bg" aria-hidden="true" />;
}
