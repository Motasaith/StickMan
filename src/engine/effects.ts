// Particle effects computed purely from time: the same frame always looks the same,
// so the live preview, scrubbing and the exported video match exactly.

import type { Ctx } from "./render";
import type { EffectObj } from "./scene";

/** Deterministic 0..1 noise for particle i, channel k. */
function rnd(seed: number, i: number, k: number): number {
  let h = (seed * 374761393 + i * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const CONFETTI = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93", "#ff924c"];
const LEAVES = ["#d9480f", "#f08c00", "#e8590c", "#a61e4d", "#5c940d"];

const BASE_COUNT: Record<EffectObj["kind"], number> = {
  rain: 160,
  snow: 110,
  confetti: 90,
  smoke: 26,
  sparkles: 40,
  bubbles: 30,
  leaves: 26,
  fire: 44,
  stars: 70,
  hearts: 18,
};

export function drawEffect(ctx: Ctx, fx: EffectObj, t: number) {
  const { w, h } = fx;
  const areaScale = Math.max(0.15, (w * h) / (1280 * 720));
  const emitter = fx.kind === "smoke" || fx.kind === "fire";
  const n = Math.max(1, Math.round(BASE_COUNT[fx.kind] * fx.density * (emitter ? 1 : areaScale)));
  const seed = fx.seed || 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  ctx.lineCap = "round";

  for (let i = 0; i < n; i++) {
    const r0 = rnd(seed, i, 0);
    const r1 = rnd(seed, i, 1);
    const r2 = rnd(seed, i, 2);
    const r3 = rnd(seed, i, 3);
    switch (fx.kind) {
      case "rain": {
        const speed = 900 + r1 * 500;
        const len = 14 + r2 * 16;
        const y = ((r0 * (h + len) + t * speed) % (h + len)) - len;
        const x = r3 * (w + 60) - 30 + (y / h) * -30;
        ctx.strokeStyle = fx.color ?? "rgba(90,130,200,0.75)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 5, y + len);
        ctx.stroke();
        break;
      }
      case "snow": {
        const speed = 40 + r1 * 60;
        const size = 2 + r2 * 4;
        const y = ((r0 * (h + 20) + t * speed) % (h + 20)) - 10;
        const x = r3 * w + Math.sin(t * (0.8 + r1) + i) * 18;
        ctx.fillStyle = fx.color ?? "#ffffff";
        ctx.strokeStyle = "rgba(120,140,170,0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case "confetti":
      case "leaves": {
        const leaves = fx.kind === "leaves";
        const speed = leaves ? 60 + r1 * 50 : 110 + r1 * 120;
        const y = ((r0 * (h + 40) + t * speed) % (h + 40)) - 20;
        const x = r3 * w + Math.sin(t * (1.2 + r2 * 2) + i * 1.7) * (leaves ? 40 : 22);
        const rot = t * (2 + r2 * 5) + i;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.scale(1, Math.abs(Math.cos(t * 3 + i)) * 0.8 + 0.2);
        const palette = leaves ? LEAVES : CONFETTI;
        ctx.fillStyle = fx.color ?? palette[i % palette.length];
        ctx.beginPath();
        if (leaves) ctx.ellipse(0, 0, 9, 4.5, 0, 0, Math.PI * 2);
        else ctx.rect(-5, -3, 10, 6);
        ctx.fill();
        ctx.restore();
        break;
      }
      case "smoke":
      case "fire": {
        const fire = fx.kind === "fire";
        const life = fire ? 0.9 + r1 * 0.5 : 2.5 + r1 * 2;
        const age = (t + r0 * life) % life;
        const k = age / life;
        const rise = fire ? h * 0.9 : h;
        const x = w / 2 + (r3 - 0.5) * w * (fire ? 0.5 : 0.3) * (fire ? 1 - k : 1) + Math.sin(age * 3 + i) * (fire ? 6 : 16) * k;
        const y = h - k * rise;
        const size = fire ? (w * 0.14 + r2 * w * 0.08) * (1 - k * 0.8) : (w * 0.08 + r2 * w * 0.06) * (0.6 + k * 1.8);
        if (fire) {
          const col = k < 0.3 ? [255, 230, 120] : k < 0.6 ? [255, 150, 40] : [220, 60, 30];
          ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(1 - k) * 0.85})`;
        } else {
          const g = fx.color ? null : 140 + Math.round(r2 * 40);
          ctx.fillStyle = fx.color ?? `rgba(${g},${g},${g},${0.45 * (1 - k)})`;
        }
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, size), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "sparkles":
      case "stars": {
        const x = r0 * w;
        const y = r1 * h;
        const tw = Math.sin((t * (fx.kind === "stars" ? 1.5 : 4) + r2 * 10) * (1 + r3));
        const a = fx.kind === "stars" ? 0.45 + 0.55 * Math.abs(tw) : Math.max(0, tw);
        if (a <= 0.02) break;
        const size = (fx.kind === "stars" ? 2 + r3 * 3 : 5 + r3 * 8) * (fx.kind === "sparkles" ? a : 1);
        ctx.fillStyle = fx.color ?? (fx.kind === "stars" ? `rgba(255,250,220,${a})` : `rgba(255,215,0,${a})`);
        ctx.beginPath();
        for (let p = 0; p < 8; p++) {
          const ang = (p * Math.PI) / 4;
          const rr = p % 2 === 0 ? size : size * 0.35;
          ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "bubbles": {
        const speed = 40 + r1 * 60;
        const size = 5 + r2 * 12;
        const y = h + size - ((r0 * (h + size * 2) + t * speed) % (h + size * 2));
        const x = r3 * w + Math.sin(t * 2 + i) * 10;
        ctx.strokeStyle = fx.color ?? "rgba(120,190,255,0.9)";
        ctx.fillStyle = "rgba(200,235,255,0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - size * 0.35, y - size * 0.35, size * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fill();
        break;
      }
      case "hearts": {
        const life = 2.5 + r1;
        const age = (t + r0 * life) % life;
        const k = age / life;
        const x = r3 * w + Math.sin(age * 2 + i) * 14;
        const y = h - k * h;
        const size = 8 + r2 * 10;
        ctx.save();
        ctx.fillStyle = fx.color ?? `rgba(255,77,109,${1 - k})`;
        ctx.globalAlpha *= 1 - k * 0.7;
        ctx.beginPath();
        ctx.moveTo(x, y + size * 0.3);
        ctx.bezierCurveTo(x, y, x - size, y, x - size, y + size * 0.35);
        ctx.bezierCurveTo(x - size, y + size * 0.8, x, y + size, x, y + size * 1.25);
        ctx.bezierCurveTo(x, y + size, x + size, y + size * 0.8, x + size, y + size * 0.35);
        ctx.bezierCurveTo(x + size, y, x, y, x, y + size * 0.3);
        ctx.fill();
        ctx.restore();
        break;
      }
    }
  }
  ctx.restore();
}
