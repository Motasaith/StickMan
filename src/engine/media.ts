// Drawing for the editor-style objects: animated SVGs, pictures and video with looks,
// styled text, captions, cover-up regions, slide backgrounds and transitions, and idle
// loops. Everything is a pure function of time so preview, export and the AI's frames match.

import type {
  Background,
  CaptionObj,
  ChromaKey,
  ColorAdjust,
  ImageObj,
  LoopKind,
  RegionObj,
  Scene,
  Slide,
  SvgObj,
  TextObj,
  TransitionKind,
  VideoObj,
  Word,
  AudioObj,
} from "./scene";
import { drawSvg, parseColor, parseSvg } from "./svg";
import { fontCss } from "./fonts";

type Ctx = CanvasRenderingContext2D;
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A scratch canvas for effects that need pixels (green screen, blur regions, transitions). */
export type CanvasFactory = (w: number, h: number) => { canvas: CanvasImageSource & { width: number; height: number }; ctx: Ctx } | null;

export interface MediaLookups {
  images?: (assetId: string) => CanvasImageSource | undefined;
  svgs?: (src: string) => string | undefined;
  /** The frame of a video object's source at a second of the source file. */
  videoFrame?: (obj: VideoObj, sourceTime: number) => CanvasImageSource | undefined;
  makeCanvas?: CanvasFactory;
}

const TAU = Math.PI * 2;

// ── Loops ───────────────────────────────────────────────────────────

/** Apply an idle loop around the middle of a box. Returns an opacity multiplier. */
export function applyLoop(ctx: Ctx, kind: LoopKind | undefined, amount: number | undefined, t: number, box: Rect): number {
  if (!kind || kind === "none") return 1;
  const a = amount ?? 1;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const size = Math.max(20, Math.min(box.w, box.h));
  const around = (fn: () => void, px = cx, py = cy) => {
    ctx.translate(px, py);
    fn();
    ctx.translate(-px, -py);
  };
  switch (kind) {
    case "float":
      ctx.translate(0, -Math.sin((TAU * t) / 2.6) * size * 0.05 * a);
      return 1;
    case "pulse": {
      const s = 1 + 0.06 * a * Math.sin((TAU * t) / 1.6);
      around(() => ctx.scale(s, s));
      return 1;
    }
    case "breathe": {
      const s = 1 + 0.03 * a * Math.sin((TAU * t) / 3.2);
      around(() => ctx.scale(s, s));
      return 1;
    }
    case "wiggle":
      around(() => ctx.rotate(((4 * a * Math.sin((TAU * t) / 0.8)) * Math.PI) / 180));
      return 1;
    case "swing":
      around(() => ctx.rotate(((10 * a * Math.sin((TAU * t) / 2)) * Math.PI) / 180), cx, box.y);
      return 1;
    case "spin":
      around(() => ctx.rotate((TAU * t * a) / 4));
      return 1;
    case "bounce": {
      const phase = (t / 0.8) % 1;
      const up = Math.sin(Math.PI * phase);
      const squash = phase < 0.08 || phase > 0.92 ? 1 - 0.12 * a : 1;
      ctx.translate(0, -up * size * 0.14 * a);
      around(() => ctx.scale(1 / Math.sqrt(squash), squash), cx, box.y + box.h);
      return 1;
    }
    case "shake":
      ctx.translate(Math.sin(TAU * t * 12) * 4 * a, Math.cos(TAU * t * 9) * 2 * a);
      return 1;
    case "heartbeat": {
      const p = (t / 1.2) % 1;
      const bump = (c: number, w: number) => Math.max(0, 1 - Math.abs(p - c) / w);
      const s = 1 + 0.1 * a * Math.max(bump(0.1, 0.1), bump(0.32, 0.1) * 0.7);
      around(() => ctx.scale(s, s));
      return 1;
    }
    case "blink":
      return 0.35 + 0.65 * (0.5 + 0.5 * Math.cos((TAU * t) / 1.2));
  }
  return 1;
}

// ── Color ───────────────────────────────────────────────────────────

/** A canvas filter for brightness, contrast, saturation and blur (warmth is a tint, see tintWarmth). */
export function adjustFilter(a: ColorAdjust | null | undefined): string {
  if (!a) return "none";
  const parts: string[] = [];
  if (a.brightness) parts.push(`brightness(${(1 + a.brightness / 100).toFixed(3)})`);
  if (a.contrast) parts.push(`contrast(${(1 + a.contrast / 100).toFixed(3)})`);
  if (a.saturation) parts.push(`saturate(${Math.max(0, 1 + a.saturation / 100).toFixed(3)})`);
  if (a.blur) parts.push(`blur(${Math.max(0, a.blur)}px)`);
  return parts.length ? parts.join(" ") : "none";
}

/** Warm (orange) or cool (blue) tint over what was just drawn in the current clip. */
export function tintWarmth(ctx: Ctx, warmth: number | undefined, x: number, y: number, w: number, h: number) {
  if (!warmth) return;
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha *= Math.min(1, Math.abs(warmth) / 100) * 0.7;
  ctx.fillStyle = warmth > 0 ? "#ff9a3c" : "#3c8dff";
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// ── Pictures and video ──────────────────────────────────────────────

function sourceSize(src: CanvasImageSource): { w: number; h: number } {
  const s = src as { videoWidth?: number; videoHeight?: number; naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  return { w: s.videoWidth || s.naturalWidth || s.width || 1, h: s.videoHeight || s.naturalHeight || s.height || 1 };
}

export function shapePath(ctx: Ctx, shape: "rect" | "rounded" | "circle" | "ellipse" | undefined, w: number, h: number) {
  ctx.beginPath();
  if (shape === "circle" || shape === "ellipse") ctx.ellipse(w / 2, h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, TAU);
  else if (shape === "rounded") roundedRect(ctx, 0, 0, w, h, Math.min(Math.abs(w), Math.abs(h)) * 0.08);
  else ctx.rect(0, 0, w, h);
}

export function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

const keyedCache = new Map<string, CanvasImageSource>();

/** The source with the key color made transparent. Stills are cached; video frames reuse a canvas. */
function keyed(src: CanvasImageSource, key: ChromaKey, make: CanvasFactory, cacheKey: string | null): CanvasImageSource {
  const sig = cacheKey ? `${cacheKey}|${key.color}|${key.similarity}|${key.smoothness}` : null;
  if (sig && keyedCache.has(sig)) return keyedCache.get(sig)!;
  const { w: sw, h: sh } = sourceSize(src);
  const scale = Math.min(1, 960 / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const c = make(w, h);
  const kc = parseColor(key.color);
  if (!c || !kc) return src;
  c.ctx.drawImage(src, 0, 0, w, h);
  const img = c.ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const uv = (r: number, g: number, b: number): [number, number] => [(-0.169 * r - 0.331 * g + 0.5 * b) / 255, (0.5 * r - 0.419 * g - 0.081 * b) / 255];
  const [ku, kv] = uv(kc[0], kc[1], kc[2]);
  const sim = key.similarity;
  const smooth = Math.max(1e-4, key.smoothness);
  for (let i = 0; i < d.length; i += 4) {
    const [u, v] = uv(d[i], d[i + 1], d[i + 2]);
    const dist = Math.hypot(u - ku, v - kv);
    if (dist < sim) d[i + 3] = 0;
    else if (dist < sim + smooth) d[i + 3] = Math.round(d[i + 3] * ((dist - sim) / smooth));
  }
  c.ctx.putImageData(img, 0, 0);
  if (sig) {
    if (keyedCache.size > 30) keyedCache.clear();
    keyedCache.set(sig, c.canvas);
  }
  return c.canvas;
}

/** Draw a picture or a video frame into the object's box with its look (crop, shape, color, key, border). */
export function drawMedia(ctx: Ctx, src: CanvasImageSource | undefined, obj: ImageObj | VideoObj, make: CanvasFactory | undefined, stillKey: string | null) {
  const { w, h } = obj;
  if (!src) {
    ctx.save();
    ctx.fillStyle = obj.type === "video" ? "rgba(40,40,40,0.35)" : "rgba(0,0,0,0.04)";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#999";
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);
    ctx.restore();
    return;
  }
  const size = sourceSize(src);
  const crop = obj.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const sx = crop.x * size.w;
  const sy = crop.y * size.h;
  const sW = Math.max(1, crop.w * size.w);
  const sH = Math.max(1, crop.h * size.h);
  ctx.save();
  if (obj.shadow) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = Math.min(w, h) * 0.06;
    ctx.shadowOffsetY = Math.min(w, h) * 0.02;
    shapePath(ctx, obj.shape, w, h);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();
  }
  if (obj.shape && obj.shape !== "rect") {
    shapePath(ctx, obj.shape, w, h);
    ctx.clip();
  }
  let image = src;
  if (obj.chroma && make) {
    image = keyed(src, obj.chroma, make, stillKey);
  }
  const imgSize = image === src ? size : sourceSize(image);
  const k = imgSize.w / size.w;
  ctx.save();
  if (obj.flipX) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  const filter = adjustFilter(obj.adjust);
  if (filter !== "none") ctx.filter = filter;
  ctx.drawImage(image, sx * k, sy * k, sW * k, sH * k, 0, 0, w, h);
  ctx.filter = "none";
  ctx.restore();
  tintWarmth(ctx, obj.adjust?.warmth, 0, 0, w, h);
  ctx.restore();
  if (obj.border && obj.border.width > 0) {
    ctx.save();
    shapePath(ctx, obj.shape, w, h);
    ctx.lineWidth = obj.border.width;
    ctx.strokeStyle = obj.border.color;
    ctx.stroke();
    ctx.restore();
  }
}

/** Where in its source file a video is at scene time t, or null when it isn't on screen. */
export function videoSourceTime(v: VideoObj, t: number): number | null {
  const local = t - v.start;
  if (local < -1e-6 || local > v.duration + (v.freeze ?? 0) + 1e-6) return null;
  const l = Math.max(0, Math.min(local, v.duration));
  const span = v.duration * v.speed;
  return v.reverse ? v.in + span - l * v.speed : v.in + l * v.speed;
}

/** Where in its source an audio clip is at scene time t, or null outside it. */
export function audioSourceTime(a: AudioObj, t: number): number | null {
  const local = t - a.start;
  if (local < 0 || local > a.duration) return null;
  return a.in + local * a.speed;
}

// ── SVG objects ─────────────────────────────────────────────────────

export function drawSvgObj(ctx: Ctx, obj: SvgObj, t: number, svgs: MediaLookups["svgs"]) {
  const markup = svgs?.(obj.src);
  const doc = markup ? parseSvg(markup) : null;
  if (!doc) {
    ctx.save();
    ctx.strokeStyle = "#b8c0cc";
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, obj.w, obj.h);
    ctx.restore();
    return;
  }
  ctx.save();
  if (obj.flipX) {
    ctx.translate(obj.w, 0);
    ctx.scale(-1, 1);
  }
  drawSvg(ctx, doc, Math.max(0, (t - obj.clock) * obj.speed), obj.w, obj.h, { colors: obj.colors });
  ctx.restore();
}

// ── Text ────────────────────────────────────────────────────────────

export interface TextLayout {
  lines: string[];
  subLines: string[];
  /** Widest line. */
  width: number;
  lineH: number;
  subSize: number;
  /** Bounds relative to the anchor (x,y), including boxes around the text. */
  box: Rect;
  pad: number;
}

function measure(ctx: Ctx | undefined, text: string, font: string, size: number, spacing = 0): number {
  if (!ctx) return text.length * size * 0.55 + spacing * text.length;
  ctx.save();
  ctx.font = font;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w + spacing * text.length;
}

export function wrap(ctx: Ctx | undefined, text: string, font: string, size: number, maxWidth: number | undefined, spacing: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (!maxWidth) {
      out.push(para);
      continue;
    }
    let line = "";
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (line && measure(ctx, test, font, size, spacing) > maxWidth) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

export function layoutText(ctx: Ctx | undefined, obj: TextObj): TextLayout {
  const font = fontCss(obj.font, obj.size, obj.bold, obj.italic, obj.text);
  const spacing = obj.letterSpacing ?? 0;
  const lines = wrap(ctx, obj.text, font, obj.size, obj.maxWidth, spacing);
  const lineH = obj.size * (obj.lineHeight ?? 1.25);
  const width = Math.max(0, ...lines.map((l) => measure(ctx, l, font, obj.size, spacing)));
  const style = obj.style ?? "plain";
  const subSize = obj.size * 0.55;
  const subLines = style === "lowerThird" && obj.subtext ? wrap(ctx, obj.subtext, fontCss(obj.font, subSize, false, false, obj.subtext), subSize, obj.maxWidth, 0) : [];
  const subW = Math.max(0, ...subLines.map((l) => measure(ctx, l, fontCss(obj.font, subSize, false, false, l), subSize)));
  const pad = style === "box" || style === "lowerThird" ? obj.size * 0.35 : style === "highlight" ? obj.size * 0.15 : 0;
  const outline = style === "outline" ? obj.size * 0.08 : style === "shadow" ? obj.size * 0.1 : 0;
  const w = Math.max(width, subW) + pad * 2 + outline * 2;
  const h = lines.length * lineH + (subLines.length ? subLines.length * subSize * 1.3 + pad * 1.4 : 0) + pad * 2 + outline * 2;
  const x = obj.align === "center" ? -w / 2 : obj.align === "right" ? -w : 0;
  return { lines, subLines, width, lineH, subSize, box: { x: x - (obj.align === "left" ? pad + outline : 0), y: -pad - outline, w, h }, pad };
}

/** Draw a text object at the origin, `reveal` (0..1) typing it out. */
export function drawTextObj(ctx: Ctx, obj: TextObj, reveal: number) {
  const L = layoutText(ctx, obj);
  const style = obj.style ?? "plain";
  const font = fontCss(obj.font, obj.size, obj.bold, obj.italic, obj.text);
  const total = L.lines.reduce((n, l) => n + l.length, 0);
  let remaining = reveal >= 1 ? Infinity : Math.floor(total * Math.max(0, reveal));
  const accent = obj.accent ?? "#E11D48";
  ctx.save();
  ctx.textBaseline = "top";
  const spacing = obj.letterSpacing ?? 0;
  if (spacing) (ctx as Ctx & { letterSpacing?: string }).letterSpacing = `${spacing}px`;

  if (style === "box" || style === "lowerThird") {
    const mainH = L.lines.length * L.lineH + L.pad * 2;
    const bw = L.width + L.pad * 2;
    const bx = obj.align === "center" ? -bw / 2 : obj.align === "right" ? -bw : -L.pad;
    ctx.fillStyle = accent;
    ctx.beginPath();
    roundedRect(ctx, bx, -L.pad, bw, mainH, Math.min(obj.size * 0.2, 14));
    ctx.fill();
    if (style === "lowerThird" && L.subLines.length) {
      ctx.font = fontCss(obj.font, L.subSize, false, false, obj.subtext);
      const sw = Math.max(...L.subLines.map((l) => ctx.measureText(l).width)) + L.pad * 2;
      const sh = L.subLines.length * L.subSize * 1.3 + L.pad * 1.2;
      const sx = obj.align === "center" ? -sw / 2 : obj.align === "right" ? -sw : -L.pad;
      ctx.fillStyle = "rgba(20,22,28,0.88)";
      ctx.beginPath();
      roundedRect(ctx, sx, mainH - L.pad * 0.6, sw, sh, Math.min(obj.size * 0.15, 10));
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = obj.align;
      const ax = obj.align === "left" ? 0 : 0;
      L.subLines.forEach((line, i) => ctx.fillText(line, ax, mainH - L.pad * 0.6 + L.pad * 0.6 + i * L.subSize * 1.3));
    }
  }

  ctx.font = font;
  ctx.textAlign = obj.align;
  L.lines.forEach((line, i) => {
    if (remaining <= 0) return;
    const shown = line.slice(0, remaining);
    remaining -= line.length;
    const y = i * L.lineH;
    if (style === "highlight") {
      const lw = ctx.measureText(line).width;
      const lx = obj.align === "center" ? -lw / 2 : obj.align === "right" ? -lw : 0;
      ctx.save();
      ctx.fillStyle = accent;
      ctx.globalAlpha *= 0.85;
      ctx.beginPath();
      ctx.moveTo(lx - L.pad, y + obj.size * 0.12);
      ctx.lineTo(lx + lw + L.pad * 1.4, y + obj.size * 0.05);
      ctx.lineTo(lx + lw + L.pad, y + obj.size * 1.12);
      ctx.lineTo(lx - L.pad * 1.3, y + obj.size * 1.18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (style === "outline") {
      ctx.lineWidth = obj.size * 0.16;
      ctx.lineJoin = "round";
      ctx.strokeStyle = accent === "#E11D48" && !obj.accent ? "#111111" : accent;
      ctx.strokeText(shown, 0, y);
    }
    if (style === "shadow") {
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = obj.size * 0.18;
      ctx.shadowOffsetY = obj.size * 0.06;
    }
    if (style === "gradient") {
      const lw = ctx.measureText(line).width;
      const lx = obj.align === "center" ? -lw / 2 : obj.align === "right" ? -lw : 0;
      const g = ctx.createLinearGradient(lx, y, lx + lw, y + obj.size);
      g.addColorStop(0, obj.color);
      g.addColorStop(1, accent);
      ctx.fillStyle = g;
    } else ctx.fillStyle = obj.color;
    ctx.fillText(shown, 0, y);
    ctx.shadowColor = "transparent";
  });
  ctx.restore();
}

// ── Captions ────────────────────────────────────────────────────────

export interface CaptionLine {
  start: number;
  end: number;
  words: Word[];
}

const lineCache = new WeakMap<Word[], Map<number, CaptionLine[]>>();

export function captionLines(words: Word[], maxChars: number): CaptionLine[] {
  let byChars = lineCache.get(words);
  if (!byChars) {
    byChars = new Map();
    lineCache.set(words, byChars);
  }
  const hit = byChars.get(maxChars);
  if (hit) return hit;
  const sorted = [...words].filter((w) => w.text.trim()).sort((a, b) => a.start - b.start);
  const lines: CaptionLine[] = [];
  let cur: Word[] = [];
  let chars = 0;
  const close = () => {
    if (cur.length) lines.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur });
    cur = [];
    chars = 0;
  };
  for (const w of sorted) {
    const len = w.text.length + (cur.length ? 1 : 0);
    const pause = cur.length ? w.start - cur[cur.length - 1].end : 0;
    if (cur.length && (chars + len > maxChars || pause > 0.7)) close();
    cur.push(w);
    chars += len;
    if (/[.!?]$/.test(w.text) && chars > maxChars * 0.5) close();
  }
  close();
  byChars.set(maxChars, lines);
  return lines;
}

/** The caption line on screen at t. */
export function captionLineAt(c: CaptionObj, t: number): CaptionLine | null {
  const lines = captionLines(c.words, c.maxChars);
  for (let i = 0; i < lines.length; i++) {
    const next = lines[i + 1];
    const until = Math.min(lines[i].end + 0.4, next ? next.start : Infinity);
    if (t >= lines[i].start - 0.05 && t < until) return lines[i];
  }
  return null;
}

interface PlacedWord {
  word: Word;
  x: number;
  w: number;
}

function placeCaption(ctx: Ctx, scene: Scene, c: CaptionObj, line: CaptionLine, scale: number, dx: number, dy: number) {
  const size = c.size * scale;
  ctx.font = fontCss(c.font, size, true, false, line.words.map((w) => w.text).join(" "));
  const space = ctx.measureText(" ").width;
  const widths = line.words.map((w) => ctx.measureText(w.text).width);
  const total = widths.reduce((a, b) => a + b, 0) + space * (line.words.length - 1);
  const cx = scene.width / 2 + dx;
  const y = (c.position === "top" ? scene.height * 0.1 : c.position === "middle" ? scene.height / 2 - size / 2 : scene.height * 0.86 - size) + dy;
  let x = cx - total / 2;
  const placed: PlacedWord[] = line.words.map((word, i) => {
    const p = { word, x, w: widths[i] };
    x += widths[i] + space;
    return p;
  });
  return { placed, size, total, cx, y };
}

export function captionBox(ctx: Ctx, scene: Scene, c: CaptionObj, t: number, scale = 1, dx = 0, dy = 0): Rect | null {
  const line = captionLineAt(c, t) ?? captionLines(c.words, c.maxChars)[0];
  if (!line) return null;
  ctx.save();
  const { size, total, cx, y } = placeCaption(ctx, scene, c, line, scale, dx, dy);
  ctx.restore();
  const pad = size * 0.4;
  return { x: cx - total / 2 - pad, y: y - pad, w: total + pad * 2, h: size * 1.2 + pad * 2 };
}

/** Draw the caption line at t in screen space. */
export function drawCaption(ctx: Ctx, scene: Scene, c: CaptionObj, t: number, scale = 1, dx = 0, dy = 0) {
  const line = captionLineAt(c, t);
  if (!line) return;
  ctx.save();
  const { placed, size, total, cx, y } = placeCaption(ctx, scene, c, line, scale, dx, dy);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  const pad = size * 0.35;
  if (c.style === "box") {
    ctx.fillStyle = "rgba(0,0,0,0.68)";
    ctx.beginPath();
    roundedRect(ctx, cx - total / 2 - pad, y - pad * 0.7, total + pad * 2, size * 1.2 + pad * 1.4, size * 0.25);
    ctx.fill();
  }
  const current = placed.find((p) => t >= p.word.start && t < p.word.end) ?? placed.filter((p) => p.word.start <= t).pop();
  for (const p of placed) {
    const spoken = p.word.start <= t;
    const isCur = p === current;
    ctx.save();
    if (c.style === "highlight" && isCur) {
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      roundedRect(ctx, p.x - size * 0.15, y - size * 0.08, p.w + size * 0.3, size * 1.25, size * 0.2);
      ctx.fill();
    }
    let color = c.color;
    if (c.style === "karaoke" && spoken) color = c.accent;
    if (c.style === "pop" && isCur) color = c.accent;
    if (c.style === "pop" && isCur) {
      const k = 1.18;
      ctx.translate(p.x + p.w / 2, y + size / 2);
      ctx.scale(k, k);
      ctx.translate(-(p.x + p.w / 2), -(y + size / 2));
    }
    if (c.style === "outline" || c.style === "karaoke" || c.style === "pop") {
      ctx.lineWidth = size * 0.18;
      ctx.strokeStyle = "#000000";
      ctx.strokeText(p.word.text, p.x, y);
    } else if (c.style === "standard") {
      ctx.shadowColor = "rgba(0,0,0,0.75)";
      ctx.shadowBlur = size * 0.2;
      ctx.shadowOffsetY = size * 0.05;
    }
    ctx.fillStyle = color;
    ctx.fillText(p.word.text, p.x, y);
    ctx.restore();
  }
  ctx.restore();
}

/** Words spread over a stretch of time in proportion to their length (voices speak evenly). */
export function estimateWords(text: string, start: number, duration: number): Word[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length || duration <= 0) return [];
  const weight = (w: string) => w.length + 1;
  const total = tokens.reduce((n, w) => n + weight(w), 0);
  let t = start;
  return tokens.map((w) => {
    const d = (weight(w) / total) * duration;
    const word = { start: Math.round(t * 1000) / 1000, end: Math.round((t + d) * 1000) / 1000, text: w };
    t += d;
    return word;
  });
}

// ── Regions ─────────────────────────────────────────────────────────

/** The device-pixel bounding box of a local rectangle under the current transform. */
function deviceBox(ctx: Ctx, w: number, h: number, canvasW: number, canvasH: number) {
  const m = ctx.getTransform();
  const pts = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
  const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1]))));
  const x1 = Math.min(canvasW, Math.ceil(Math.max(...pts.map((p) => p[0]))));
  const y1 = Math.min(canvasH, Math.ceil(Math.max(...pts.map((p) => p[1]))));
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

export function drawRegion(ctx: Ctx, obj: RegionObj, make: CanvasFactory | undefined) {
  const { w, h } = obj;
  const canvas = (ctx as Ctx & { canvas?: CanvasImageSource & { width: number; height: number } }).canvas;
  const shape = obj.shape === "ellipse" ? "ellipse" : "rect";
  switch (obj.kind) {
    case "redact":
      ctx.save();
      shapePath(ctx, shape === "rect" ? "rounded" : shape, w, h);
      ctx.fillStyle = obj.color || "#000000";
      ctx.fill();
      ctx.restore();
      return;
    case "highlight":
      ctx.save();
      shapePath(ctx, shape === "rect" ? "rounded" : shape, w, h);
      ctx.fillStyle = obj.color;
      ctx.globalAlpha *= 0.18;
      ctx.fill();
      ctx.globalAlpha /= 0.18;
      ctx.lineWidth = Math.max(3, obj.strength);
      ctx.strokeStyle = obj.color;
      ctx.stroke();
      ctx.restore();
      return;
    case "spotlight": {
      if (!canvas) return;
      ctx.save();
      ctx.beginPath();
      if (shape === "ellipse") ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, TAU);
      else roundedRect(ctx, 0, 0, w, h, Math.min(w, h) * 0.08);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0.1, Math.min(0.9, obj.strength / 100))})`;
      ctx.fill("evenodd");
      ctx.restore();
      return;
    }
    case "blur":
    case "pixelate":
    case "magnify": {
      if (!canvas || !make) return;
      const box = deviceBox(ctx, w, h, canvas.width, canvas.height);
      if (box.w < 2 || box.h < 2) return;
      ctx.save();
      shapePath(ctx, shape, w, h);
      ctx.clip();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (obj.kind === "blur") {
        const pad = Math.ceil(obj.strength * 2);
        const bx = Math.max(0, box.x - pad);
        const by = Math.max(0, box.y - pad);
        const bw = Math.min(canvas.width - bx, box.w + pad * 2);
        const bh = Math.min(canvas.height - by, box.h + pad * 2);
        const tmp = make(bw, bh);
        if (tmp) {
          tmp.ctx.drawImage(canvas, bx, by, bw, bh, 0, 0, bw, bh);
          ctx.filter = `blur(${Math.max(1, obj.strength)}px)`;
          ctx.drawImage(tmp.canvas, bx, by);
          ctx.drawImage(tmp.canvas, bx, by);
          ctx.filter = "none";
        }
      } else if (obj.kind === "pixelate") {
        const block = Math.max(3, obj.strength);
        const tw = Math.max(1, Math.round(box.w / block));
        const th = Math.max(1, Math.round(box.h / block));
        const tmp = make(tw, th);
        if (tmp) {
          tmp.ctx.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, tw, th);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(tmp.canvas, 0, 0, tw, th, box.x, box.y, box.w, box.h);
          ctx.imageSmoothingEnabled = true;
        }
      } else {
        const zoom = Math.max(1.2, obj.strength / 10);
        const tmp = make(box.w, box.h);
        if (tmp) {
          const sw = box.w / zoom;
          const sh = box.h / zoom;
          tmp.ctx.drawImage(canvas, box.x + (box.w - sw) / 2, box.y + (box.h - sh) / 2, sw, sh, 0, 0, box.w, box.h);
          ctx.drawImage(tmp.canvas, box.x, box.y);
        }
      }
      ctx.restore();
      if (obj.kind === "magnify") {
        ctx.save();
        shapePath(ctx, shape, w, h);
        ctx.lineWidth = 5;
        ctx.strokeStyle = obj.color || "#ffffff";
        ctx.stroke();
        ctx.restore();
      }
      return;
    }
  }
}

// ── Backgrounds and slides ──────────────────────────────────────────

export function drawBackground(ctx: Ctx, bg: Background | null | undefined, w: number, h: number, images: MediaLookups["images"]) {
  if (!bg) return;
  if (bg.kind === "color") {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, w, h);
  } else if (bg.kind === "gradient") {
    let g: CanvasGradient;
    if (bg.radial) g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
    else {
      const a = (bg.angle * Math.PI) / 180;
      const dx = Math.sin(a);
      const dy = -Math.cos(a);
      const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
      g = ctx.createLinearGradient(w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half);
    }
    g.addColorStop(0, bg.from);
    g.addColorStop(1, bg.to);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else {
    const img = images?.(bg.asset);
    if (img) {
      const s = sourceSize(img);
      const k = Math.max(w / s.w, h / s.h);
      ctx.drawImage(img, (w - s.w * k) / 2, (h - s.h * k) / 2, s.w * k, s.h * k);
      if (bg.dim) {
        ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(0.9, bg.dim))})`;
        ctx.fillRect(0, 0, w, h);
      }
    } else {
      ctx.fillStyle = "#1f2330";
      ctx.fillRect(0, 0, w, h);
    }
  }
}

/** The slide on screen at t, the previous one while a transition runs, and the transition's progress. */
export function slidesAt(scene: Scene, t: number): { cur: Slide; prev: Slide | null; p: number } | null {
  const slides = scene.slides;
  if (!slides?.length) return null;
  let i = slides.findIndex((s) => t >= s.start && t < s.start + s.duration);
  if (i < 0) i = t < slides[0].start ? 0 : slides.length - 1;
  const cur = slides[i];
  const prev = i > 0 ? slides[i - 1] : null;
  const d = cur.transition.duration;
  if (!prev || cur.transition.kind === "cut" || d <= 0) return { cur, prev: null, p: 1 };
  const p = (t - cur.start) / d;
  if (p >= 1 || p < 0) return { cur, prev: null, p: 1 };
  return { cur, prev, p };
}

function easeInOut(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

/** Draw the transition from picture A (the old slide) to picture B (the new one) at progress p. */
export function composeTransition(ctx: Ctx, kind: TransitionKind, p: number, A: CanvasImageSource, B: CanvasImageSource, w: number, h: number) {
  const e = easeInOut(Math.max(0, Math.min(1, p)));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  switch (kind) {
    case "fade":
    case "cut":
      ctx.drawImage(A, 0, 0, w, h);
      ctx.globalAlpha = e;
      ctx.drawImage(B, 0, 0, w, h);
      break;
    case "slideLeft":
    case "slideRight":
    case "slideUp":
    case "slideDown": {
      ctx.drawImage(A, 0, 0, w, h);
      const off = 1 - e;
      const x = kind === "slideLeft" ? off * w : kind === "slideRight" ? -off * w : 0;
      const y = kind === "slideUp" ? off * h : kind === "slideDown" ? -off * h : 0;
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 30;
      ctx.drawImage(B, x, y, w, h);
      break;
    }
    case "push":
      ctx.drawImage(A, -e * w, 0, w, h);
      ctx.drawImage(B, (1 - e) * w, 0, w, h);
      break;
    case "zoom": {
      ctx.save();
      const sa = 1 + e * 0.25;
      ctx.globalAlpha = 1 - e;
      ctx.translate(w / 2, h / 2);
      ctx.scale(sa, sa);
      ctx.drawImage(A, -w / 2, -h / 2, w, h);
      ctx.restore();
      const sb = 0.85 + 0.15 * e;
      ctx.globalAlpha = e;
      ctx.translate(w / 2, h / 2);
      ctx.scale(sb, sb);
      ctx.drawImage(B, -w / 2, -h / 2, w, h);
      break;
    }
    case "wipe":
      ctx.drawImage(A, 0, 0, w, h);
      ctx.beginPath();
      ctx.rect(0, 0, e * w, h);
      ctx.clip();
      ctx.drawImage(B, 0, 0, w, h);
      break;
    case "circle":
      ctx.drawImage(A, 0, 0, w, h);
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, (e * Math.hypot(w, h)) / 2, 0, TAU);
      ctx.clip();
      ctx.drawImage(B, 0, 0, w, h);
      break;
    case "blur":
      ctx.filter = `blur(${(e * 16).toFixed(1)}px)`;
      ctx.globalAlpha = 1 - e;
      ctx.drawImage(A, 0, 0, w, h);
      ctx.filter = `blur(${((1 - e) * 16).toFixed(1)}px)`;
      ctx.globalAlpha = e;
      ctx.drawImage(B, 0, 0, w, h);
      ctx.filter = "none";
      break;
    case "flip": {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      ctx.translate(w / 2, 0);
      if (e < 0.5) {
        ctx.scale(Math.max(0.001, 1 - e * 2), 1);
        ctx.drawImage(A, -w / 2, 0, w, h);
      } else {
        ctx.scale(Math.max(0.001, e * 2 - 1), 1);
        ctx.drawImage(B, -w / 2, 0, w, h);
      }
      break;
    }
  }
  ctx.restore();
}
