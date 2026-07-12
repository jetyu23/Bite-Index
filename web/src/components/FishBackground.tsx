"use client";

import { useEffect, useRef } from "react";

/* The living layer of the Field Survey: silhouettes of the seven species the
   site actually scores (plus one ray, for the floor of the page), drifting
   behind the paper. Fine-pointer users get flee behaviour within 140px;
   touch devices get calm drift; reduced-motion gets a single static school.
   Ink alpha stays low so the document always wins. */

type Kind =
  | "mulloway" | "kingfish" | "tailor" | "bream" | "trevally" | "squid" | "yakka" | "ray"
  | "shark" | "octopus" | "jelly" | "whale";

interface Fish {
  k: Kind;
  x: number;
  y: number;
  a: number;
  s: number;
  base: number;
  max: number;
  L: number;
  wag: number;
  alpha: number;
}

const SPECS: { k: Kind; L: number; base: number; max: number; n?: number; alpha?: number }[] = [
  { k: "mulloway", L: 38, base: 0.42, max: 2.8 },
  { k: "kingfish", L: 32, base: 0.7, max: 3.6 },
  { k: "tailor", L: 24, base: 0.6, max: 3.2, n: 2 },
  { k: "bream", L: 18, base: 0.5, max: 3.0, n: 2 },
  { k: "trevally", L: 20, base: 0.5, max: 3.0 },
  { k: "squid", L: 22, base: 0.32, max: 4.2 },
  { k: "yakka", L: 11, base: 0.55, max: 3.4, n: 8 },
  { k: "ray", L: 34, base: 0.28, max: 1.6 },
  { k: "shark", L: 46, base: 0.5, max: 2.2, alpha: 0.13 },
  { k: "octopus", L: 20, base: 0.18, max: 1.4 },
  { k: "jelly", L: 16, base: 0.22, max: 0.5, n: 3, alpha: 0.11 },
  { k: "whale", L: 130, base: 0.16, max: 0.28, alpha: 0.06 },
];

export default function FishBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const x = c.getContext("2d");
    if (!x) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = matchMedia("(pointer: fine)").matches;

    let W = 0;
    let H = 0;
    const size = () => {
      W = c.width = innerWidth;
      H = c.height = innerHeight;
    };
    size();
    addEventListener("resize", size);

    let mx = -9999;
    let my = -9999;
    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };
    const onLeave = () => {
      mx = my = -9999;
    };
    if (fine) {
      addEventListener("pointermove", onMove, { passive: true });
      addEventListener("pointerleave", onLeave);
    }

    const fish: Fish[] = [];
    for (const sp of SPECS) {
      for (let i = 0; i < (sp.n ?? 1); i++) {
        fish.push({
          k: sp.k,
          x: Math.random() * innerWidth,
          y: sp.k === "whale" ? innerHeight * (0.65 + Math.random() * 0.25) : Math.random() * innerHeight,
          a: sp.k === "whale" ? (Math.random() < 0.5 ? 0 : Math.PI) : sp.k === "jelly" ? -Math.PI / 2 : Math.random() * Math.PI * 2,
          s: sp.base,
          base: sp.base,
          max: sp.max,
          L: sp.L + Math.random() * 4,
          wag: Math.random() * 9,
          alpha: sp.alpha ?? 0.15,
        });
      }
    }

    const ink = (a: number) => `rgba(38,37,28,${a})`;

    function forkTail(L: number, w: number, deep: number) {
      x!.lineTo(-L * 0.88, -L * deep + w);
      x!.lineTo(-L * 0.68, w * 0.5);
      x!.lineTo(-L * 0.88, L * deep + w);
    }

    function draw(f: Fish) {
      if (!x) return;
      x.save();
      x.translate(f.x, f.y);
      x.rotate(f.k === "jelly" ? 0 : f.a);
      x.fillStyle = ink(f.alpha);
      x.strokeStyle = ink(f.alpha);
      const L = f.L;
      const w = Math.sin(f.wag) * L * 0.12;
      x.beginPath();
      switch (f.k) {
        case "squid":
          x.moveTo(L * 0.75, 0);
          x.quadraticCurveTo(L * 0.2, -L * 0.3, -L * 0.15, -L * 0.16);
          x.lineTo(-L * 0.15, L * 0.16);
          x.quadraticCurveTo(L * 0.2, L * 0.3, L * 0.75, 0);
          x.fill();
          x.lineWidth = 1.6;
          for (let t = -1.5; t <= 1.5; t++) {
            x.beginPath();
            x.moveTo(-L * 0.14, t * L * 0.09);
            x.quadraticCurveTo(-L * 0.55, t * L * 0.12 + w * 0.4, -L * 0.92, t * L * 0.2 + w);
            x.stroke();
          }
          break;
        case "ray": {
          const flap = Math.sin(f.wag * 0.5) * L * 0.14;
          x.moveTo(L * 0.55, 0);
          x.quadraticCurveTo(0, -L * 0.55 - flap, -L * 0.35, 0);
          x.quadraticCurveTo(0, L * 0.55 + flap, L * 0.55, 0);
          x.fill();
          x.lineWidth = 1.4;
          x.beginPath();
          x.moveTo(-L * 0.33, 0);
          x.quadraticCurveTo(-L * 0.7, w * 0.6, -L * 1.05, w);
          x.stroke();
          break;
        }
        case "kingfish": {
          // torpedo body, sickle tail
          x.moveTo(L * 0.66, 0);
          x.quadraticCurveTo(0, -L * 0.24, -L * 0.55, w * 0.4);
          x.quadraticCurveTo(-L * 0.92, -L * 0.34 + w, -L * 0.78, w * 0.5 - L * 0.04);
          x.quadraticCurveTo(-L * 0.7, w * 0.5, -L * 0.78, w * 0.5 + L * 0.04);
          x.quadraticCurveTo(-L * 0.92, L * 0.34 + w, -L * 0.55, w * 0.4);
          x.quadraticCurveTo(0, L * 0.24, L * 0.66, 0);
          x.fill();
          break;
        }
        case "trevally": {
          // deep body, hard-forked tail
          x.moveTo(L * 0.58, 0);
          x.quadraticCurveTo(L * 0.05, -L * 0.42, -L * 0.5, w * 0.4);
          forkTail(L, w, 0.36);
          x.lineTo(-L * 0.5, w * 0.4);
          x.quadraticCurveTo(L * 0.05, L * 0.42, L * 0.58, 0);
          x.fill();
          break;
        }
        case "bream": {
          x.moveTo(L * 0.6, 0);
          x.quadraticCurveTo(0, -L * 0.46, -L * 0.5, w * 0.4);
          forkTail(L, w, 0.28);
          x.lineTo(-L * 0.5, w * 0.4);
          x.quadraticCurveTo(0, L * 0.46, L * 0.6, 0);
          x.fill();
          // spiky dorsal
          x.beginPath();
          x.moveTo(L * 0.05, -L * 0.44);
          x.lineTo(L * 0.18, -L * 0.62);
          x.lineTo(L * 0.3, -L * 0.42);
          x.fill();
          break;
        }
        case "mulloway": {
          // long, heavy-shouldered, rounded tail
          x.moveTo(L * 0.62, 0);
          x.quadraticCurveTo(L * 0.1, -L * 0.26, -L * 0.55, w * 0.4);
          x.quadraticCurveTo(-L * 0.85, w * 0.4 - L * 0.16, -L * 0.95, w);
          x.quadraticCurveTo(-L * 0.85, w * 0.4 + L * 0.16, -L * 0.55, w * 0.4);
          x.quadraticCurveTo(L * 0.1, L * 0.26, L * 0.62, 0);
          x.fill();
          break;
        }
        case "shark": {
          // slim body, tall dorsal, long upper tail lobe
          x.moveTo(L * 0.62, 0);
          x.quadraticCurveTo(0, -L * 0.2, -L * 0.55, w * 0.3);
          x.quadraticCurveTo(-L * 0.95, -L * 0.4 + w, -L * 0.8, w * 0.3 - L * 0.02);
          x.lineTo(-L * 0.86, L * 0.16 + w);
          x.lineTo(-L * 0.55, w * 0.3);
          x.quadraticCurveTo(0, L * 0.2, L * 0.62, 0);
          x.fill();
          x.beginPath(); // dorsal
          x.moveTo(-L * 0.02, -L * 0.18);
          x.lineTo(L * 0.1, -L * 0.46);
          x.lineTo(L * 0.22, -L * 0.16);
          x.fill();
          break;
        }
        case "octopus": {
          x.arc(L * 0.18, 0, L * 0.3, 0, Math.PI * 2); // head
          x.fill();
          x.lineWidth = 1.8;
          for (let t2 = -2.5; t2 <= 2.5; t2++) {
            x.beginPath();
            x.moveTo(0, t2 * L * 0.08);
            x.quadraticCurveTo(-L * 0.45, t2 * L * 0.14 + w * 0.5, -L * 0.85, t2 * L * 0.22 + w + Math.sin(f.wag + t2) * L * 0.08);
            x.stroke();
          }
          break;
        }
        case "jelly": {
          const pulse = 1 + Math.sin(f.wag * 0.7) * 0.12;
          x.arc(0, 0, L * 0.42 * pulse, Math.PI, 0); // bell (drawn pointing up; rotation handled in step)
          x.quadraticCurveTo(L * 0.3, L * 0.12, 0, L * 0.1);
          x.quadraticCurveTo(-L * 0.3, L * 0.12, -L * 0.42 * pulse, 0);
          x.fill();
          x.lineWidth = 1.3;
          for (let t2 = -1.5; t2 <= 1.5; t2++) {
            x.beginPath();
            x.moveTo(t2 * L * 0.18, L * 0.08);
            x.quadraticCurveTo(t2 * L * 0.22 + Math.sin(f.wag + t2) * 3, L * 0.5, t2 * L * 0.16 + Math.sin(f.wag * 0.8 + t2) * 5, L * 0.95);
            x.stroke();
          }
          break;
        }
        case "whale": {
          // long back, small dorsal bump, flukes
          x.moveTo(L * 0.55, -L * 0.02);
          x.quadraticCurveTo(L * 0.1, -L * 0.16, -L * 0.35, -L * 0.06);
          x.quadraticCurveTo(-L * 0.52, -L * 0.03, -L * 0.62, -L * 0.1); // tail stock up
          x.lineTo(-L * 0.72, -L * 0.16);
          x.lineTo(-L * 0.66, 0);
          x.lineTo(-L * 0.72, L * 0.16);
          x.lineTo(-L * 0.6, L * 0.06);
          x.quadraticCurveTo(-L * 0.2, L * 0.14, L * 0.3, L * 0.1);
          x.quadraticCurveTo(L * 0.5, L * 0.08, L * 0.55, -L * 0.02);
          x.fill();
          x.beginPath(); // pec fin
          x.moveTo(L * 0.12, L * 0.1);
          x.quadraticCurveTo(L * 0.02, L * 0.26, -L * 0.12, L * 0.22);
          x.quadraticCurveTo(0, L * 0.12, L * 0.12, L * 0.1);
          x.fill();
          break;
        }
        default: {
          // tailor / yakka: slim fusiform, forked tail
          const deep = f.k === "yakka" ? 0.3 : 0.22;
          x.moveTo(L * 0.62, 0);
          x.quadraticCurveTo(0, -L * deep, -L * 0.5, w * 0.4);
          forkTail(L, w, 0.3);
          x.lineTo(-L * 0.5, w * 0.4);
          x.quadraticCurveTo(0, L * deep, L * 0.62, 0);
          x.fill();
        }
      }
      x.restore();
    }

    // yakkas loosely school: they steer toward their group centroid
    const yakkas = fish.filter((f) => f.k === "yakka");

    let raf = 0;
    let running = true;
    function step() {
      if (!x) return;
      x.clearRect(0, 0, W, H);
      let cx = 0;
      let cy = 0;
      for (const y of yakkas) {
        cx += y.x;
        cy += y.y;
      }
      cx /= yakkas.length || 1;
      cy /= yakkas.length || 1;

      for (const f of fish) {
        if (f.k === "jelly") {
          f.wag += 0.06;
          f.x += Math.sin(f.wag * 0.4) * 0.35;
          f.y -= f.base * (1 + Math.sin(f.wag * 0.7) * 0.8);
          if (f.y < -60) { f.y = H + 60; f.x = Math.random() * W; }
          draw(f);
          continue;
        }
        if (f.k === "whale") {
          f.wag += 0.02;
          f.x += Math.cos(f.a) * f.base;
          f.y += Math.sin(f.wag * 0.3) * 0.12;
          if (f.x < -180) f.x = W + 180;
          if (f.x > W + 180) f.x = -180;
          draw(f);
          continue;
        }
        f.a += (Math.random() - 0.5) * (f.k === "ray" || f.k === "shark" ? 0.03 : 0.07);
        if (f.k === "yakka") {
          const da = Math.atan2(cy - f.y, cx - f.x);
          let diff = da - f.a;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          f.a += diff * 0.02;
        }
        const dx = f.x - mx;
        const dy = f.y - my;
        const d = Math.hypot(dx, dy);
        if (d < 140) {
          const flee = Math.atan2(dy, dx);
          let diff = flee - f.a;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          f.a += diff * (f.k === "ray" ? 0.06 : 0.16);
          f.s = Math.min(f.max, f.s + 0.3);
        } else {
          f.s = Math.max(f.base, f.s * 0.972);
        }
        f.x += Math.cos(f.a) * f.s;
        f.y += Math.sin(f.a) * f.s;
        f.wag += 0.22 + f.s * 0.12;
        if (f.x < -60) f.x = W + 60;
        if (f.x > W + 60) f.x = -60;
        if (f.y < -60) f.y = H + 60;
        if (f.y > H + 60) f.y = -60;
        draw(f);
      }
      if (running && !reduced) raf = requestAnimationFrame(step);
    }

    const onVis = () => {
      running = !document.hidden;
      if (running && !reduced) raf = requestAnimationFrame(step);
      else cancelAnimationFrame(raf);
    };
    document.addEventListener("visibilitychange", onVis);

    step(); // reduced motion renders one static frame and stops

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      removeEventListener("resize", size);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className="fish-bg" aria-hidden="true" />;
}
