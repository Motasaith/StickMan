// Animated intros and outros: styled title sequences added as their own section at the start
// or end of a video. Every piece is an ordinary object with keyframes, so it stays editable.

import type { Background, FontName, Scene, Slide, TransitionKind } from "./scene";
import { cloneScene } from "./scene";
import { applyOps } from "./ops";
import { removeSlide, shiftTimeline, syncCaptions } from "./slides";

export interface CardText {
  title: string;
  subtitle?: string;
  /** The channel name, shown small. */
  channel?: string;
  accent?: string;
  accent2?: string;
}

interface Template {
  id: string;
  label: string;
  blurb: string;
  duration: number;
  /** How the video continues after an intro (or arrives at an outro). */
  transition: TransitionKind;
  background: (c: Colors) => Background;
  build: (b: Builder) => void;
}

interface Colors {
  accent: string;
  accent2: string;
}

interface Builder {
  W: number;
  H: number;
  /** Seconds from the start of the section to the section's own time. */
  t: (s: number) => number;
  D: number;
  text: Required<Pick<CardText, "title">> & CardText;
  c: Colors;
  add: (op: Record<string, unknown>) => void;
  unit: number;
}

/** Split a title into balanced lines of at most `max` words each. */
function lines(title: string, count: number): string[] {
  const words = title.split(/\s+/).filter(Boolean);
  const n = Math.min(count, Math.max(1, Math.ceil(words.length / 3)));
  const per = Math.ceil(words.length / n);
  return Array.from({ length: n }, (_, i) => words.slice(i * per, (i + 1) * per).join(" ")).filter(Boolean);
}

const heading = (b: Builder, id: string, text: string, y: number, size: number, extra: Record<string, unknown> = {}) =>
  b.add({ op: "heading", id, text, x: b.W / 2, y, size: Math.round(size), align: "center", maxWidth: b.W * 0.86, color: "#FFFFFF", accent: b.c.accent, ...extra });

export const INTROS: Template[] = [
  {
    id: "cinematic",
    label: "Cinematic",
    blurb: "Slow reveal on black, serif title, a line draws in",
    duration: 4.4,
    transition: "fade",
    background: () => ({ kind: "color", color: "#050505" }),
    build(b) {
      const { W, H, t, D, unit } = b;
      if (b.text.channel) heading(b, "intro_channel", b.text.channel.toUpperCase(), H * 0.33, unit * 0.028, { font: "poppins", style: "plain", color: "#A1A1AA", at: t(0.3), until: t(D - 0.1), enter: "fade", exit: "fade" });
      heading(b, "intro_title", b.text.title, H * 0.4, unit * 0.1, { font: "dmserif", style: "shadow", at: t(0.6), until: t(D - 0.1), enter: "zoom", exit: "fade" });
      b.add({ op: "draw", id: "intro_line", name: "Line", x: W / 2 - W * 0.12, y: H * 0.4 + unit * 0.16, parts: [{ kind: "rect", x: 0, y: 0, w: W * 0.24, h: Math.max(2, unit * 0.004), fill: b.c.accent }] });
      b.add({ op: "enter", id: "intro_line", kind: "grow", at: t(1.4), duration: 0.8 });
      b.add({ op: "exit", id: "intro_line", kind: "fade", at: t(D - 0.1), duration: 0.5 });
      if (b.text.subtitle) heading(b, "intro_sub", b.text.subtitle, H * 0.4 + unit * 0.2, unit * 0.035, { font: "poppins", style: "plain", color: "#D4D4D8", at: t(1.8), until: t(D - 0.1), enter: "rise", exit: "fade" });
      b.add({ op: "sound", kind: "whoosh", at: t(0.5), volume: 0.6 });
    },
  },
  {
    id: "bold",
    label: "Bold kinetic",
    blurb: "Big words stamp in over color blocks",
    duration: 3.8,
    transition: "zoomIn",
    background: (c) => ({ kind: "gradient", from: c.accent, to: c.accent2, angle: 135 }),
    build(b) {
      const { W, H, t, unit } = b;
      b.add({ op: "draw", id: "intro_block1", name: "Block", x: -W * 0.1, y: H * 0.08, parts: [{ kind: "rect", x: 0, y: 0, w: W * 0.7, h: H * 0.16, fill: "#FFFFFF", opacity: 0.12 }] });
      b.add({ op: "enter", id: "intro_block1", kind: "slideRight", at: t(0), duration: 0.6 });
      b.add({ op: "draw", id: "intro_block2", name: "Block", x: W * 0.4, y: H * 0.76, parts: [{ kind: "rect", x: 0, y: 0, w: W * 0.7, h: H * 0.16, fill: "#000000", opacity: 0.15 }] });
      b.add({ op: "enter", id: "intro_block2", kind: "slideLeft", at: t(0.1), duration: 0.6 });
      const rows = lines(b.text.title.toUpperCase(), 3);
      const size = Math.min(unit * 0.15, (W * 0.9) / Math.max(...rows.map((r) => r.length)) / 0.62);
      const top = H / 2 - (rows.length * size * 1.05) / 2 - (b.text.subtitle ? size * 0.3 : 0);
      rows.forEach((row, i) => heading(b, `intro_line${i + 1}`, row, top + i * size * 1.05, size, { font: "anton", style: "shadow", at: t(0.35 + i * 0.28), enter: "stamp" }));
      if (b.text.subtitle) heading(b, "intro_sub", b.text.subtitle, top + rows.length * size * 1.05 + size * 0.25, unit * 0.04, { font: "poppins", style: "box", accent: "#111111", at: t(0.5 + rows.length * 0.28), enter: "slideUp" });
      b.add({ op: "sound", kind: "whoosh", at: t(0.05), volume: 0.5 });
      rows.forEach((_, i) => b.add({ op: "sound", kind: "thud", at: t(0.45 + i * 0.28), volume: 0.35 }));
    },
  },
  {
    id: "glitch",
    label: "Glitch",
    blurb: "Digital jitter with split color, then a glitch cut",
    duration: 3.4,
    transition: "glitch",
    background: () => ({ kind: "gradient", from: "#05050A", to: "#141428", angle: 160 }),
    build(b) {
      const { W, H, t, D, unit } = b;
      const size = unit * 0.13;
      const y = H / 2 - size * 0.7;
      const common = { font: "bebas" as FontName, style: "plain", at: t(0.3), enter: "glitchIn" };
      b.add({ op: "heading", id: "intro_red", text: b.text.title.toUpperCase(), x: W / 2 - unit * 0.006, y, size: Math.round(size), align: "center", maxWidth: W * 0.86, color: "#FF0040", ...common });
      b.add({ op: "heading", id: "intro_cyan", text: b.text.title.toUpperCase(), x: W / 2 + unit * 0.006, y, size: Math.round(size), align: "center", maxWidth: W * 0.86, color: "#00E5FF", ...common });
      b.add({ op: "loop", id: "intro_red", kind: "shake", amount: 0.5 });
      b.add({ op: "loop", id: "intro_cyan", kind: "shake", amount: 0.4 });
      heading(b, "intro_title", b.text.title.toUpperCase(), y, size, common);
      if (b.text.subtitle) heading(b, "intro_sub", b.text.subtitle, y + size * 1.25, unit * 0.036, { font: "roboto", style: "plain", color: "#A5F3FC", at: t(1.3), enter: "flicker" });
      b.add({ op: "draw", id: "intro_scan", name: "Scanline", x: 0, y: 0, parts: [{ kind: "rect", x: 0, y: 0, w: W, h: Math.max(3, H * 0.012), fill: "#FFFFFF", opacity: 0.08 }] });
      b.add({ op: "move", id: "intro_scan", y: H, at: t(0), duration: D });
      b.add({ op: "sound", kind: "click", at: t(0.3), volume: 0.6 });
      b.add({ op: "sound", kind: "click", at: t(0.7), volume: 0.4 });
    },
  },
  {
    id: "neon",
    label: "Neon glow",
    blurb: "Glowing title flickers on over sparkles",
    duration: 4,
    transition: "flash",
    background: () => ({ kind: "gradient", from: "#0B0620", to: "#1A0B3D", angle: 150 }),
    build(b) {
      const { W, H, t, unit } = b;
      b.add({ op: "effect", id: "intro_sparkles", kind: "sparkles", density: 0.5, at: t(0) });
      const size = unit * 0.11;
      const y = H / 2 - size * 0.8;
      heading(b, "intro_title", b.text.title, y, size, { font: "righteous", style: "glow", at: t(0.4), enter: "flicker" });
      b.add({ op: "loop", id: "intro_title", kind: "breathe", amount: 0.6 });
      const bw = Math.min(W * 0.86, size * Math.max(6, b.text.title.length * 0.6));
      const bh = size * 1.9;
      const x0 = W / 2 - bw / 2;
      const y0 = y - size * 0.35;
      const edge = { stroke: b.c.accent, width: Math.max(2, unit * 0.005) };
      b.add({
        op: "draw",
        id: "intro_frame",
        name: "Neon frame",
        x: x0,
        y: y0,
        parts: [
          { kind: "line", x1: 0, y1: 0, x2: bw, y2: 0, ...edge },
          { kind: "line", x1: bw, y1: 0, x2: bw, y2: bh, ...edge },
          { kind: "line", x1: bw, y1: bh, x2: 0, y2: bh, ...edge },
          { kind: "line", x1: 0, y1: bh, x2: 0, y2: 0, ...edge },
        ],
        at: t(0.2),
        drawOn: 1.2,
      });
      if (b.text.subtitle) heading(b, "intro_sub", b.text.subtitle, y0 + bh + unit * 0.04, unit * 0.036, { font: "poppins", style: "plain", color: b.c.accent, at: t(1.5), enter: "typewriter" });
      b.add({ op: "sound", kind: "magic", at: t(0.4), volume: 0.5 });
    },
  },
  {
    id: "minimal",
    label: "Minimal",
    blurb: "Clean type on paper, a dot and a line",
    duration: 3.6,
    transition: "fade",
    background: () => ({ kind: "color", color: "#F5F3EE" }),
    build(b) {
      const { W, H, t, unit } = b;
      const size = unit * 0.085;
      heading(b, "intro_title", b.text.title, H * 0.42, size, { font: "poppins", style: "plain", color: "#18181B", at: t(0.3), enter: "typewriter" });
      b.add({ op: "draw", id: "intro_dot", name: "Dot", x: W / 2, y: H * 0.42 - size * 0.9, parts: [{ kind: "circle", cx: 0, cy: 0, r: unit * 0.012, fill: b.c.accent }] });
      b.add({ op: "enter", id: "intro_dot", kind: "bounceIn", at: t(0.1), duration: 0.5 });
      b.add({ op: "draw", id: "intro_line", name: "Line", x: W / 2 - W * 0.06, y: H * 0.42 + size * 1.5, parts: [{ kind: "rect", x: 0, y: 0, w: W * 0.12, h: Math.max(2, unit * 0.004), fill: "#18181B" }] });
      b.add({ op: "enter", id: "intro_line", kind: "grow", at: t(1.2), duration: 0.6 });
      if (b.text.subtitle || b.text.channel) heading(b, "intro_sub", b.text.subtitle ?? b.text.channel ?? "", H * 0.42 + size * 1.8, unit * 0.032, { font: "roboto", style: "plain", color: "#52525B", at: t(1.5), enter: "fade" });
    },
  },
  {
    id: "split",
    label: "Split reveal",
    blurb: "Two color panels slide apart to show the title",
    duration: 3.6,
    transition: "push",
    background: () => ({ kind: "color", color: "#FAFAF9" }),
    build(b) {
      const { W, H, t, unit } = b;
      heading(b, "intro_title", b.text.title, H * 0.4, unit * 0.1, { font: "archivo", style: "plain", color: "#111111", at: t(0.7), enter: "rise" });
      if (b.text.subtitle) heading(b, "intro_sub", b.text.subtitle, H * 0.4 + unit * 0.15, unit * 0.036, { font: "poppins", style: "highlight", color: "#111111", at: t(1.2), enter: "fade" });
      b.add({ op: "draw", id: "intro_left", name: "Panel", x: 0, y: 0, parts: [{ kind: "rect", x: 0, y: 0, w: W / 2 + 1, h: H, fill: b.c.accent }] });
      b.add({ op: "draw", id: "intro_right", name: "Panel", x: W / 2, y: 0, parts: [{ kind: "rect", x: 0, y: 0, w: W / 2, h: H, fill: b.c.accent2 }] });
      b.add({ op: "move", id: "intro_left", x: -W / 2 - 2, at: t(0.35), duration: 0.8, ease: "easeInOut" });
      b.add({ op: "move", id: "intro_right", x: W + 2, at: t(0.35), duration: 0.8, ease: "easeInOut" });
      b.add({ op: "sound", kind: "whoosh", at: t(0.35), volume: 0.5 });
    },
  },
  {
    id: "pop",
    label: "Playful pop",
    blurb: "Bouncy title, a sticker and confetti",
    duration: 3.4,
    transition: "zoomIn",
    background: (c) => ({ kind: "gradient", from: "#FDF2F8", to: c.accent2, angle: 120, radial: true }),
    build(b) {
      const { W, H, t, unit } = b;
      const s = unit * 0.2;
      b.add({ op: "sticker", id: "intro_sticker", emoji: "sparkles", x: W / 2 - s / 2, y: H * 0.12, size: Math.round(s), at: t(0.15), enter: "bounceIn", loop: "float" });
      heading(b, "intro_title", b.text.title, H * 0.42, unit * 0.1, { font: "righteous", style: "outline", color: "#FFFFFF", accent: "#111111", at: t(0.5), enter: "bounceIn" });
      if (b.text.subtitle) heading(b, "intro_sub", b.text.subtitle, H * 0.42 + unit * 0.15, unit * 0.038, { font: "poppins", style: "highlight", color: "#111111", accent: b.c.accent, at: t(1), enter: "slideUp" });
      b.add({ op: "effect", id: "intro_confetti", kind: "confetti", density: 0.8, at: t(0.6) });
      b.add({ op: "sound", kind: "pop", at: t(0.15), volume: 0.6 });
      b.add({ op: "sound", kind: "boing", at: t(0.55), volume: 0.4 });
    },
  },
  {
    id: "news",
    label: "Breaking news",
    blurb: "Red banner, name bar and a running ticker",
    duration: 4,
    transition: "whipLeft",
    background: () => ({ kind: "gradient", from: "#0B1B3F", to: "#1E3A8A", angle: 135 }),
    build(b) {
      const { W, H, t, D, unit } = b;
      b.add({ op: "heading", id: "intro_breaking", text: "BREAKING", x: W * 0.06, y: H * 0.46, size: Math.round(unit * 0.05), align: "left", style: "box", accent: "#DC2626", color: "#FFFFFF", font: "archivo", at: t(0.2), enter: "slideRight" });
      b.add({ op: "heading", id: "intro_title", text: b.text.title, subtext: b.text.subtitle ?? b.text.channel, x: W * 0.06, y: H * 0.46 + unit * 0.1, size: Math.round(unit * 0.055), align: "left", style: "lowerThird", accent: "#FFFFFF", color: "#0B1B3F", font: "poppins", maxWidth: W * 0.8, at: t(0.55), enter: "slideRight" });
      const ticker = `${b.text.title.toUpperCase()}  •  ${(b.text.subtitle ?? "").toUpperCase()}  •  ${(b.text.channel ?? "").toUpperCase()}  •  `.repeat(2);
      b.add({ op: "draw", id: "intro_bar", name: "Ticker bar", x: 0, y: H * 0.88, parts: [{ kind: "rect", x: 0, y: 0, w: W, h: H * 0.08, fill: "#DC2626" }] });
      b.add({ op: "heading", id: "intro_ticker", text: ticker, x: W, y: H * 0.895, size: Math.round(unit * 0.03), align: "left", style: "plain", color: "#FFFFFF", font: "roboto", at: t(0) });
      b.add({ op: "move", id: "intro_ticker", x: -W * 1.2, at: t(0), duration: D + 1 });
      b.add({ op: "sound", kind: "ding", at: t(0.2), volume: 0.6 });
    },
  },
];

export const OUTROS: Template[] = [
  {
    id: "endscreen",
    label: "End screen",
    blurb: "Room for YouTube's end-screen videos and subscribe button",
    duration: 10,
    transition: "fade",
    background: (c) => ({ kind: "gradient", from: "#0A0A0F", to: c.accent2, angle: 150 }),
    build(b) {
      const { W, H, t, unit } = b;
      const vertical = H > W;
      heading(b, "outro_title", "Thanks for watching", H * 0.08, unit * 0.07, { font: "poppins", style: "shadow", at: t(0.3), enter: "rise" });
      // Two cards where the end-screen videos go, and the subscribe spot.
      const cw = vertical ? W * 0.8 : W * 0.34;
      const ch = cw * 0.5625;
      const cards = vertical ? [[W * 0.1, H * 0.25], [W * 0.1, H * 0.25 + ch + unit * 0.06]] : [[W * 0.1, H * 0.3], [W * 0.56, H * 0.3]];
      cards.forEach(([x, y], i) => {
        b.add({
          op: "draw",
          id: `outro_card${i + 1}`,
          name: i ? "Best video spot" : "Next video spot",
          x,
          y,
          parts: [
            { kind: "rect", x: 0, y: 0, w: cw, h: ch, r: unit * 0.02, fill: "#FFFFFF", opacity: 0.06, stroke: "#FFFFFF", width: 2 },
            { kind: "text", x: cw / 2, y: ch / 2 - unit * 0.02, text: i ? "Most popular" : "Watch next", size: Math.round(unit * 0.035), align: "center", fill: "#FFFFFF", opacity: 0.8 },
          ],
        });
        b.add({ op: "enter", id: `outro_card${i + 1}`, kind: "pop", at: t(0.7 + i * 0.25), duration: 0.6 });
      });
      const sub = vertical ? H * 0.8 : H * 0.8;
      b.add({ op: "heading", id: "outro_subscribe", text: "SUBSCRIBE", x: W / 2, y: sub, size: Math.round(unit * 0.045), align: "center", style: "box", accent: "#DC2626", color: "#FFFFFF", font: "archivo", at: t(1.3), enter: "bounceIn" });
      b.add({ op: "loop", id: "outro_subscribe", kind: "pulse", amount: 0.5 });
      const bell = Math.round(unit * 0.08);
      b.add({ op: "sticker", id: "outro_bell", emoji: "bell", x: W / 2 + unit * 0.17, y: sub - unit * 0.01, size: bell, at: t(1.6), enter: "pop", loop: "swing" });
      if (b.text.channel) heading(b, "outro_channel", b.text.channel, sub - unit * 0.07, unit * 0.03, { font: "poppins", style: "plain", color: "#D4D4D8", at: t(1.1), enter: "fade" });
      b.add({ op: "sound", kind: "ding", at: t(1.3), volume: 0.5 });
    },
  },
  {
    id: "thanks",
    label: "Thanks for watching",
    blurb: "A warm sign-off with confetti",
    duration: 5,
    transition: "fade",
    background: (c) => ({ kind: "gradient", from: c.accent, to: c.accent2, angle: 135 }),
    build(b) {
      const { W, H, t, unit } = b;
      const s = Math.round(unit * 0.16);
      b.add({ op: "sticker", id: "outro_wave", emoji: "wave hello", x: W / 2 - s / 2, y: H * 0.18, size: s, at: t(0.2), enter: "bounceIn", loop: "wiggle" });
      heading(b, "outro_title", "Thanks for watching!", H * 0.45, unit * 0.09, { font: "righteous", style: "shadow", at: t(0.5), enter: "bounceIn" });
      heading(b, "outro_sub", b.text.subtitle || "See you in the next one", H * 0.45 + unit * 0.13, unit * 0.04, { font: "poppins", style: "plain", at: t(1.1), enter: "rise" });
      if (b.text.channel) heading(b, "outro_channel", b.text.channel, H * 0.85, unit * 0.03, { font: "poppins", style: "box", accent: "#111111", at: t(1.4), enter: "fade" });
      b.add({ op: "effect", id: "outro_confetti", kind: "confetti", density: 0.9, at: t(0.5) });
      b.add({ op: "sound", kind: "applause", at: t(0.5), volume: 0.4 });
    },
  },
  {
    id: "next",
    label: "Watch next",
    blurb: "Points viewers to your next video",
    duration: 8,
    transition: "whipLeft",
    background: () => ({ kind: "gradient", from: "#111827", to: "#1F2937", angle: 140 }),
    build(b) {
      const { W, H, t, unit } = b;
      const vertical = H > W;
      heading(b, "outro_title", "Watch this next", H * 0.12, unit * 0.075, { font: "archivo", style: "plain", at: t(0.3), enter: "slideRight" });
      const cw = vertical ? W * 0.8 : W * 0.46;
      const ch = cw * 0.5625;
      const x = vertical ? W * 0.1 : W * 0.44;
      const y = vertical ? H * 0.35 : H * 0.3;
      b.add({ op: "draw", id: "outro_card", name: "Next video spot", x, y, parts: [{ kind: "rect", x: 0, y: 0, w: cw, h: ch, r: unit * 0.02, fill: "#FFFFFF", opacity: 0.07, stroke: b.c.accent, width: 3 }] });
      b.add({ op: "enter", id: "outro_card", kind: "zoom", at: t(0.6), duration: 0.6 });
      const s = Math.round(unit * 0.14);
      b.add({ op: "sticker", id: "outro_arrow", emoji: vertical ? "point down" : "point right", x: vertical ? W / 2 - s / 2 : W * 0.26, y: vertical ? H * 0.22 : y + ch / 2 - s / 2, size: s, at: t(0.9), enter: "slideRight", loop: "bounce" });
      if (b.text.channel) heading(b, "outro_channel", `Subscribe to ${b.text.channel}`, H * 0.86, unit * 0.034, { font: "poppins", style: "box", accent: "#DC2626", at: t(1.3), enter: "rise" });
      b.add({ op: "sound", kind: "whoosh", at: t(0.3), volume: 0.5 });
    },
  },
];

export const introById = (id: string) => INTROS.find((x) => x.id === id);
export const outroById = (id: string) => OUTROS.find((x) => x.id === id);

const DARK = "#111827";

/**
 * Scenes without sections (animations) become one section first, so an intro can come before
 * the rest without the rest showing through it.
 */
function ensureSections(scene: Scene) {
  if (scene.slides?.length) return;
  const main: Slide = { id: "main", title: scene.title ?? "Main", start: 0, duration: scene.duration, background: scene.backgroundFill ?? { kind: "color", color: scene.background || "#ffffff" }, transition: { kind: "cut", duration: 0 } };
  scene.slides = [main];
  for (const o of scene.objects) if (!o.slide && o.type !== "audio" && o.type !== "sound" && o.type !== "caption" && o.type !== "light") o.slide = "main";
}

function place(scene: Scene, template: Template, card: CardText, start: number, prefix: "intro" | "outro"): { ops: unknown[]; section: string } {
  const W = scene.width;
  const H = scene.height;
  const c: Colors = { accent: card.accent ?? "#F5B400", accent2: card.accent2 ?? DARK };
  const ops: Array<Record<string, unknown>> = [];
  template.build({
    W,
    H,
    D: template.duration,
    t: (s) => Math.round((start + s) * 1000) / 1000,
    text: { ...card, title: card.title.trim() || "Untitled" },
    c,
    unit: Math.min(W, H) * (W > H ? 1.25 : 1),
    // Sounds get ids too, so they belong to this section.
    add: (op) => ops.push(op.op === "sound" && !op.id ? { ...op, id: `${prefix}_sfx${ops.length + 1}` } : op),
  });
  return { ops, section: prefix };
}

function apply(scene: Scene, ops: unknown[], section: string): { scene: Scene; problems: string[] } {
  const out = applyOps(scene, ops, []);
  const made = new Set((ops as Array<{ id?: string }>).map((o) => o.id).filter(Boolean));
  for (const o of out.scene.objects) if (made.has(o.id)) o.slide = section;
  return { scene: out.scene, problems: out.results.filter((r) => !r.ok).map((r) => r.message) };
}

/** Put an animated intro before everything else (replacing an existing one). */
export function addIntro(input: Scene, templateId: string, card: CardText): { scene: Scene; problems: string[] } {
  const template = introById(templateId);
  if (!template) throw new Error(`no intro called "${templateId}"`);
  let scene = cloneScene(input);
  if (scene.slides?.some((s) => s.id === "intro")) removeSlide(scene, "intro");
  ensureSections(scene);
  const D = template.duration;
  shiftTimeline(scene, 0, D);
  const first = scene.slides![0];
  if (first) first.transition = { kind: template.transition, duration: template.transition === "cut" ? 0 : 0.5 };
  scene.slides!.unshift({ id: "intro", title: "Intro", start: 0, duration: D, background: template.background({ accent: card.accent ?? "#F5B400", accent2: card.accent2 ?? DARK }), transition: { kind: "cut", duration: 0 }, layout: "intro" });
  scene.markers = [{ t: 0, label: "Intro" }, ...(scene.markers ?? [])];
  const { ops, section } = place(scene, template, card, 0, "intro");
  const res = apply(scene, ops, section);
  scene = res.scene;
  syncCaptions(scene);
  // A sectioned video ends where its last section does.
  const end = scene.slides![scene.slides!.length - 1];
  scene.duration = Math.round((end.start + end.duration) * 1000) / 1000;
  return { scene, problems: res.problems };
}

/** Put an animated outro after everything else (replacing an existing one). */
export function addOutro(input: Scene, templateId: string, card: CardText): { scene: Scene; problems: string[] } {
  const template = outroById(templateId);
  if (!template) throw new Error(`no outro called "${templateId}"`);
  let scene = cloneScene(input);
  if (scene.slides?.some((s) => s.id === "outro")) removeSlide(scene, "outro");
  ensureSections(scene);
  const last = scene.slides![scene.slides!.length - 1];
  const start = last ? Math.round((last.start + last.duration) * 1000) / 1000 : scene.duration;
  const D = template.duration;
  scene.slides!.push({ id: "outro", title: "Outro", start, duration: D, background: template.background({ accent: card.accent ?? "#F5B400", accent2: card.accent2 ?? DARK }), transition: { kind: template.transition, duration: template.transition === "cut" ? 0 : 0.5 }, layout: "outro" });
  scene.markers = [...(scene.markers ?? []), { t: start, label: "Outro" }];
  scene.duration = Math.round((start + D) * 1000) / 1000;
  const { ops, section } = place(scene, template, card, start, "outro");
  const res = apply(scene, ops, section);
  scene = res.scene;
  scene.duration = Math.round((start + D) * 1000) / 1000;
  return { scene, problems: res.problems };
}
