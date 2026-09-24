"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Particle = {
  r: number;
  a: number;
  speed: number;
  width: number;
  alpha: number;
  trail: number;
};

const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

/**
 * O campo de origem: um ponto de luz no escuro e partículas girando ao redor,
 * como o rastro de estrelas do manifesto. No começo tudo está no centro (o zero)
 * e se expande até a órbita.
 */
export function OriginField({
  className,
  center = { x: 0.5, y: 0.5 },
  mobileCenter = { x: 0.5, y: 0.38 },
}: {
  className?: string;
  center?: { x: number; y: number };
  mobileCenter?: { x: number; y: number };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let raf = 0;
    let visible = true;
    let last = performance.now();
    const start = last;
    const pointer = { x: 0, y: 0 };
    const eased = { x: 0, y: 0 };

    function setup() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.max(1, Math.round(width * dpr));
      canvas!.height = Math.max(1, Math.round(height * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const small = width < 768;
      const count = small ? 240 : 520;
      const maxR = Math.hypot(width, height) * (small ? 0.52 : 0.62);
      particles = Array.from({ length: count }, () => {
        const t = Math.random();
        const r = 14 + Math.pow(t, 0.9) * maxR;
        // Quanto mais longe do centro, mais devagar (como uma longa exposição).
        const speed = (0.000055 + Math.random() * 0.00004) * (1 + 120 / (r + 40));
        return {
          r,
          a: Math.random() * Math.PI * 2,
          speed,
          width: 0.5 + Math.random() * 1.1,
          alpha: 0.12 + Math.random() * 0.7,
          trail: 0.05 + Math.random() * 0.22,
        };
      });
    }

    function draw(now: number) {
      const dt = Math.min(64, now - last);
      last = now;
      const elapsed = now - start;
      const intro = reduced ? 1 : easeOutExpo(Math.min(1, elapsed / 2600));
      const small = width < 768;
      const c = small ? mobileCenter : center;

      eased.x += (pointer.x - eased.x) * 0.04;
      eased.y += (pointer.y - eased.y) * 0.04;
      const cx = width * c.x + eased.x * 16;
      const cy = height * c.y + eased.y * 16;

      ctx!.clearRect(0, 0, width, height);
      ctx!.lineCap = "round";
      ctx!.strokeStyle = "#ffffff";

      for (const p of particles) {
        if (!reduced) p.a += p.speed * dt;
        const r = p.r * intro;
        const len = p.trail * (0.35 + 0.65 * intro);
        ctx!.globalAlpha = p.alpha * (0.25 + 0.75 * intro);
        ctx!.lineWidth = p.width;
        ctx!.beginPath();
        ctx!.arc(cx, cy, Math.max(0.1, r), p.a - len, p.a);
        ctx!.stroke();
      }

      // O ponto de luz e o halo.
      ctx!.globalAlpha = 1;
      const pulse = reduced ? 1 : 0.9 + 0.1 * Math.sin(elapsed / 1100);
      const glowR = (small ? 150 : 240) * (0.2 + 0.8 * intro) * pulse;
      const glow = ctx!.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      glow.addColorStop(0, "rgba(255,255,255,0.95)");
      glow.addColorStop(0.03, "rgba(255,255,255,0.6)");
      glow.addColorStop(0.18, "rgba(255,255,255,0.10)");
      glow.addColorStop(0.5, "rgba(255,255,255,0.025)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx!.fillStyle = glow;
      ctx!.fillRect(cx - glowR, cy - glowR, glowR * 2, glowR * 2);

      ctx!.beginPath();
      ctx!.fillStyle = "#ffffff";
      ctx!.arc(cx, cy, 1.6, 0, Math.PI * 2);
      ctx!.fill();

      if (!reduced && visible) raf = requestAnimationFrame(draw);
    }

    setup();
    raf = requestAnimationFrame(draw);

    const ro = new ResizeObserver(() => {
      setup();
      if (reduced) draw(performance.now());
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(([entry]) => {
      const was = visible;
      visible = entry.isIntersecting && document.visibilityState === "visible";
      if (visible && !was && !reduced) {
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    });
    io.observe(canvas);

    function onVisibility() {
      const was = visible;
      visible = document.visibilityState === "visible";
      if (visible && !was && !reduced) {
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    function onPointer(e: PointerEvent) {
      pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
    }
    window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.x, center.y, mobileCenter.x, mobileCenter.y]);

  return <canvas ref={canvasRef} className={cn("block size-full", className)} aria-hidden />;
}
