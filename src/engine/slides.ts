// Presentations: slides laid out from their content with a theme, entrances timed to the
// narration, and the timeline kept in order when slides grow, move or go away.

import type { AudioObj, Background, ChartKind, ChartObj, DrawingObj, FontName, Scene, SceneObj, Slide, SvgObj, TextObj, TransitionKind, VoiceRef, Word } from "./scene";
import { findObj, uniqueId } from "./scene";
import { backgroundColor, themeById, type Theme } from "./themes";
import { parseColor } from "./svg";
import { enter, type EnterKind } from "./entrances";
import { estimateWords, wrap } from "./media";
import { fontCss } from "./fonts";
import { findIllustration } from "./illustrations";
import { findSticker } from "./stickers";

function isDark(color: string): boolean {
  const c = parseColor(color);
  if (!c) return false;
  return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 < 0.55;
}

export const SLIDE_LAYOUTS = ["title", "bullets", "split", "illustration", "stat", "chart", "quote", "steps", "comparison", "section", "closing", "image"] as const;
export type SlideLayout = (typeof SLIDE_LAYOUTS)[number];

export interface SlideSpec {
  id?: string;
  layout: SlideLayout;
  title?: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  /** A library illustration id or topic ("teeth", "sales growth"), or "emoji:<char or name>". */
  illustration?: string;
  /** An imported picture's asset id (image layout and split). */
  image?: string;
  stat?: { value: number; label: string; prefix?: string; suffix?: string; decimals?: number };
  chart?: { kind: ChartKind; data: { label: string; value: number }[]; unit?: string };
  quote?: { text: string; author?: string };
  steps?: string[];
  comparison?: { leftTitle: string; left: string[]; rightTitle: string; right: string[] };
  narration?: string;
  voice?: VoiceRef;
  duration?: number;
  transition?: TransitionKind;
  background?: Background;
}

export interface BuildResult {
  slide: Slide;
  messages: string[];
}

/** Roughly how long a voice takes to say a text. */
export function speechSeconds(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, words * 0.4 + 0.4);
}

/** Width of a text in em, from typical proportional-font character widths (layout runs without a canvas). */
function emWidth(text: string): number {
  let w = 0;
  for (const ch of text) {
    if (ch === " ") w += 0.28;
    else if ("iljtfr.,;:'!|()[]".includes(ch) || ch === "I") w += 0.3;
    else if ("mwMW@%".includes(ch)) w += 0.86;
    else if (ch >= "A" && ch <= "Z") w += 0.66;
    else if (ch >= "0" && ch <= "9") w += 0.56;
    else if (ch.charCodeAt(0) > 0x2e80) w += 1;
    else w += 0.54;
  }
  return w;
}
const approxWidth = (text: string, size: number) => emWidth(text) * size;
let measureCtx: CanvasRenderingContext2D | undefined;

/** A canvas to measure text with (browser or Node canvas). Without one, layout estimates widths. */
export function setTextMeasureContext(ctx: CanvasRenderingContext2D | undefined) {
  measureCtx = ctx;
}

/** Lines a text wraps to at maxWidth, wrapping at words like the renderer does. */
const linesFor = (text: string, size: number, maxWidth: number, font: FontName = "roboto", italic = false) => {
  if (measureCtx) return Math.max(1, wrap(measureCtx, text, fontCss(font, size, false, italic, text), size, maxWidth, 0).length);
  let lines = 0;
  for (const para of text.split("\n")) {
    let line = "";
    lines++;
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (line && approxWidth(test, size) > maxWidth) {
        lines++;
        line = word;
      } else line = test;
    }
  }
  return Math.max(1, lines);
};

function obj<T extends SceneObj>(scene: Scene, base: string, rest: Omit<T, "id" | "name" | "rotation" | "scale" | "opacity" | "tracks">, name?: string): T {
  const id = uniqueId(scene, base);
  const o = { id, name: name ?? id, rotation: 0, scale: 1, opacity: 1, tracks: {}, ...rest } as unknown as T;
  scene.objects.push(o);
  return o;
}

function text(scene: Scene, slide: Slide, base: string, value: string, x: number, y: number, size: number, color: string, font: TextObj["font"], extra: Partial<TextObj> = {}): TextObj {
  return obj<TextObj>(scene, `${slide.id}_${base}`, {
    type: "text",
    x,
    y,
    text: value,
    size,
    color,
    font,
    align: "left",
    bold: false,
    slide: slide.id,
    ...extra,
  } as Omit<TextObj, "id" | "name" | "rotation" | "scale" | "opacity" | "tracks">, value.slice(0, 24));
}

/** A picture for a slide: library illustration, sticker or imported picture, fitted in a box. */
function picture(scene: Scene, slide: Slide, ref: string, x: number, y: number, w: number, h: number, at: number, messages: string[]): SceneObj | null {
  if (ref.startsWith("asset:")) {
    const svg: SvgObj = { id: uniqueId(scene, `${slide.id}_art`), name: "Illustration", x, y, rotation: 0, scale: 1, opacity: 1, tracks: {}, type: "svg", src: ref, w, h, clock: at, speed: 1, slide: slide.id };
    scene.objects.push(svg);
    return svg;
  }
  if (ref.startsWith("emoji:")) {
    const sticker = findSticker(ref.slice(6));
    if (!sticker) {
      messages.push(`no sticker for "${ref.slice(6)}"`);
      return null;
    }
    const s = Math.min(w, h) * 0.8;
    const svg: SvgObj = { id: uniqueId(scene, `${slide.id}_sticker`), name: sticker.name, x: x + (w - s) / 2, y: y + (h - s) / 2, rotation: 0, scale: 1, opacity: 1, tracks: {}, type: "svg", src: `emoji:${sticker.code}`, w: s, h: s, clock: at, speed: 1, slide: slide.id, loop: "float", loopAmount: 0.6 };
    scene.objects.push(svg);
    return svg;
  }
  const ill = findIllustration(ref.replace(/^lib:/, ""));
  if (!ill) {
    messages.push(`no library illustration for "${ref}"`);
    return null;
  }
  const svg: SvgObj = { id: uniqueId(scene, `${slide.id}_art`), name: ill.name, x, y, rotation: 0, scale: 1, opacity: 1, tracks: {}, type: "svg", src: `lib:${ill.id}`, w, h, clock: at, speed: 1, slide: slide.id };
  scene.objects.push(svg);
  return svg;
}

function drawing(scene: Scene, slide: Slide, base: string, x: number, y: number, parts: DrawingObj["parts"]): DrawingObj {
  return obj<DrawingObj>(scene, `${slide.id}_${base}`, { type: "drawing", x, y, parts, slide: slide.id } as Omit<DrawingObj, "id" | "name" | "rotation" | "scale" | "opacity" | "tracks">);
}

/** Add one slide at the end of the presentation. */
export function addSlide(scene: Scene, spec: SlideSpec, themeId?: string): BuildResult {
  const theme = themeById(themeId ?? scene.theme);
  scene.theme = theme.id;
  const slides = (scene.slides ??= []);
  const start = slides.length ? slides[slides.length - 1].start + slides[slides.length - 1].duration : 0;
  const id = spec.id && !slides.some((s) => s.id === spec.id) && !findObj(scene, spec.id) ? spec.id : uniqueSlideId(scene);
  const cover = spec.layout === "title" || spec.layout === "section" || spec.layout === "closing";
  const transition = slides.length ? { kind: spec.transition ?? theme.transition, duration: 0.7 } : { kind: "cut" as TransitionKind, duration: 0 };
  const slide: Slide = {
    id,
    title: spec.title ?? spec.layout,
    start,
    duration: 5,
    background: spec.background ?? (cover ? theme.cover : theme.background),
    transition,
    notes: spec.narration,
    layout: spec.layout,
  };
  slides.push(slide);
  const messages: string[] = [];

  // Content arrives once the transition has mostly played.
  const t0 = start + transition.duration * 0.7 + 0.15;
  const narrStart = start + transition.duration * 0.5 + 0.35;
  const speech = spec.narration ? speechSeconds(spec.narration) : 0;
  const content = layout(scene, slide, spec, theme, t0, speech, messages);

  let narration: AudioObj | null = null;
  if (spec.narration) {
    narration = {
      id: uniqueId(scene, `${id}_voice`),
      name: `Narration: ${spec.narration.slice(0, 24)}`,
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
      opacity: 1,
      tracks: {},
      type: "audio",
      asset: null,
      role: "narration",
      start: Math.round(narrStart * 100) / 100,
      duration: Math.round(speech * 100) / 100,
      in: 0,
      speed: 1,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      text: spec.narration,
      voice: spec.voice ?? "narrator",
      words: estimateWords(spec.narration, narrStart, speech),
      slide: id,
    };
    scene.objects.push(narration);
  }
  const needed = Math.max(content - start, narration ? narration.start + narration.duration - start + 1.1 : 0, 4);
  slide.duration = Math.round((spec.duration ?? needed) * 10) / 10;
  if (scene.duration < slide.start + slide.duration) scene.duration = Math.round((slide.start + slide.duration) * 10) / 10;
  syncCaptions(scene);
  return { slide, messages };
}

function uniqueSlideId(scene: Scene): string {
  for (let i = (scene.slides?.length ?? 0) + 1; ; i++) {
    const id = `slide${i}`;
    if (!scene.slides?.some((s) => s.id === id) && !findObj(scene, id)) return id;
  }
}

/** Build a slide's objects. Returns the time its last entrance finishes. */
function layout(scene: Scene, slide: Slide, spec: SlideSpec, th: Theme, t0: number, speech: number, messages: string[]): number {
  const W = scene.width;
  const H = scene.height;
  const m = W * 0.07;
  const coverLayout = spec.layout === "title" || spec.layout === "section" || spec.layout === "closing";
  const dark = isDark(backgroundColor(slide.background));
  const headColor = spec.background ? (dark ? "#FFFFFF" : th.heading) : coverLayout ? th.coverText : th.heading;
  const bodyColor = spec.background ? (dark ? "#E8ECF5" : th.text) : coverLayout ? th.coverText : th.text;
  let last = t0 + 1;
  const done = (t: number) => (last = Math.max(last, t));
  const vertical = H > W;

  const heading = (value: string, maxWidth: number, x = m, y = H * 0.09, align: TextObj["align"] = "left") => {
    const size = Math.round(Math.min(H * 0.08, W * 0.056));
    const h = text(scene, slide, "title", value, x, y, size, headColor, th.headingFont, { maxWidth, align });
    enter(h, "slideUp", t0, 0.6);
    const lines = linesFor(value, size, maxWidth, th.headingFont);
    const ux = align === "center" ? x - H * 0.045 : x;
    const bar = drawing(scene, slide, "bar", ux, y + lines * size * 1.25 + H * 0.015, [{ kind: "rect", x: 0, y: 0, w: H * 0.09, h: Math.max(4, H * 0.01), r: 4, fill: th.accent }]);
    enter(bar, "grow", t0 + 0.25, 0.5);
    done(t0 + 0.75);
    return y + lines * size * 1.25 + H * 0.06;
  };

  const bulletList = (items: string[], x: number, y: number, maxWidth: number, bottom: number) => {
    const n = items.length;
    let size = Math.round(Math.min(H * 0.056, W * 0.04));
    const estimate = (s: number) => items.reduce((sum, it) => sum + linesFor(it, s, maxWidth - s * 1.4, th.bodyFont) * s * 1.3 + s * 0.9, 0);
    while (size > 14 && y + estimate(size) > bottom) size -= 2;
    // Sit the list in the middle of the space under the heading, leaning up.
    let yy = Math.max(y, y + (bottom - y - estimate(size)) * 0.35);
    items.forEach((item, i) => {
      // Spread bullets over the narration so each appears about when it is spoken.
      const at = speech > 0 ? t0 + 0.4 + (speech * 0.85 * i) / Math.max(1, n) : t0 + 0.5 + i * 0.55;
      const dot = drawing(scene, slide, `dot${i + 1}`, x, yy + size * 0.2, [{ kind: "circle", cx: size * 0.3, cy: size * 0.35, r: size * 0.26, fill: th.accent }]);
      const tx = text(scene, slide, `point${i + 1}`, item, x + size * 1.2, yy, size, bodyColor, th.bodyFont, { maxWidth: maxWidth - size * 1.4 });
      enter(dot, "pop", at, 0.4);
      enter(tx, "slideLeft", at, 0.5);
      yy += linesFor(item, size, maxWidth - size * 1.4, th.bodyFont) * size * 1.3 + size * 0.9;
      done(at + 0.6);
    });
  };

  const art = (ref: string | undefined, x: number, y: number, w: number, h: number, at: number, kind: EnterKind = "pop") => {
    if (!ref && !spec.image) return null;
    const pic = spec.image
      ? pictureFromImage(scene, slide, spec.image, x, y, w, h)
      : picture(scene, slide, ref!, x, y, w, h, at, messages);
    if (pic) {
      enter(pic, kind, at, 0.7);
      done(at + 0.7);
    }
    return pic;
  };

  switch (spec.layout) {
    case "title":
    case "section":
    case "closing": {
      const hasArt = !!(spec.illustration || spec.image);
      const size = Math.round(Math.min(H * (spec.layout === "section" ? 0.1 : 0.095), W * 0.065));
      const title = spec.title ?? (spec.layout === "closing" ? "Thank you" : "");
      const maxWidth = hasArt && !vertical ? W * 0.5 : W * 0.8;
      const x = hasArt && !vertical ? m : W / 2;
      const align = hasArt && !vertical ? "left" : "center";
      const lines = linesFor(title, size, maxWidth, th.headingFont);
      const blockH = lines * size * 1.2 + (spec.subtitle ? size * 0.9 : 0);
      const y = hasArt && vertical ? H * 0.52 : H / 2 - blockH / 2 - size * 0.2;
      if (spec.layout === "section") {
        const eyebrow = text(scene, slide, "eyebrow", `PART ${slides(scene).indexOf(slide) + 1}`, x, y - size * 0.9, Math.round(size * 0.32), th.accent2, th.bodyFont, { align, letterSpacing: 4 });
        enter(eyebrow, "fade", t0, 0.5);
      }
      const tt = text(scene, slide, "title", title, x, y, size, headColor, th.headingFont, { align, maxWidth });
      enter(tt, spec.layout === "closing" ? "pop" : "slideUp", t0, 0.7);
      done(t0 + 0.7);
      if (spec.subtitle) {
        const st = text(scene, slide, "subtitle", spec.subtitle, x, y + lines * size * 1.2 + size * 0.2, Math.round(size * 0.42), bodyColor, th.bodyFont, { align, maxWidth });
        enter(st, "fade", t0 + 0.45, 0.6);
        done(t0 + 1.05);
      }
      if (hasArt) {
        if (vertical) art(spec.illustration, W * 0.2, H * 0.12, W * 0.6, H * 0.36, t0 + 0.3);
        else art(spec.illustration, W * 0.58, H * 0.14, W * 0.36, H * 0.72, t0 + 0.3);
      }
      break;
    }
    case "bullets": {
      const hasArt = !!(spec.illustration || spec.image) && !vertical;
      const colW = hasArt ? W * 0.52 : W - m * 2;
      const y = heading(spec.title ?? "", colW);
      if (spec.body) {
        const size = Math.round(Math.min(H * 0.04, W * 0.03));
        const b = text(scene, slide, "body", spec.body, m, y, size, bodyColor, th.bodyFont, { maxWidth: colW });
        enter(b, "fade", t0 + 0.3, 0.6);
      }
      const by = spec.body ? y + linesFor(spec.body, Math.round(Math.min(H * 0.04, W * 0.03)), colW, th.bodyFont) * H * 0.052 + H * 0.03 : y;
      // Captions sit across the bottom, so the list stops above them.
      bulletList(spec.bullets ?? [], m, by, colW, H * 0.8);
      if (hasArt) art(spec.illustration, W * 0.62, H * 0.2, W * 0.32, H * 0.64, t0 + 0.2);
      else if (spec.illustration && vertical) art(spec.illustration, W * 0.25, H * 0.66, W * 0.5, H * 0.28, t0 + 0.2);
      break;
    }
    case "split":
    case "illustration":
    case "image": {
      if (spec.layout === "illustration" || vertical) {
        const y = heading(spec.title ?? "", W - m * 2, W / 2, H * 0.08, "center");
        const boxH = H * 0.86 - y - (spec.body ? H * 0.14 : 0);
        art(spec.illustration, W / 2 - Math.min(boxH, W * 0.8) / 2, y, Math.min(boxH, W * 0.8), boxH, t0 + 0.3);
        if (spec.body) {
          const size = Math.round(Math.min(H * 0.042, W * 0.03));
          const b = text(scene, slide, "body", spec.body, W / 2, H * 0.84, size, bodyColor, th.bodyFont, { maxWidth: W * 0.8, align: "center" });
          enter(b, "fade", t0 + 0.8, 0.6);
          done(t0 + 1.4);
        }
      } else {
        art(spec.illustration, m, H * 0.12, W * 0.4, H * 0.76, t0 + 0.1, "slideRight");
        const x = W * 0.52;
        const colW = W * 0.42;
        const y = heading(spec.title ?? "", colW, x, H * 0.16);
        if (spec.body) {
          const size = Math.round(Math.min(H * 0.042, W * 0.03));
          const b = text(scene, slide, "body", spec.body, x, y, size, bodyColor, th.bodyFont, { maxWidth: colW, lineHeight: 1.4 });
          enter(b, "fade", t0 + 0.4, 0.7);
          done(t0 + 1.1);
        }
        if (spec.bullets?.length) bulletList(spec.bullets, x, spec.body ? y + linesFor(spec.body, Math.round(Math.min(H * 0.042, W * 0.03)), colW, th.bodyFont) * H * 0.06 + H * 0.02 : y, colW, H * 0.8);
      }
      break;
    }
    case "stat": {
      const s = spec.stat ?? { value: 0, label: "" };
      const y = spec.title ? heading(spec.title, W - m * 2, W / 2, H * 0.08, "center") : H * 0.2;
      const size = Math.round(Math.min(H * 0.24, W * 0.16));
      const hasArt = !!spec.illustration && !vertical;
      const cx = hasArt ? W * 0.38 : W / 2;
      const num = text(scene, slide, "number", `${s.prefix ?? ""}${s.value}${s.suffix ?? ""}`, cx, Math.max(y, H * 0.28), size, th.accent, th.headingFont, {
        align: "center",
        counter: { from: 0, to: s.value, start: t0 + 0.3, duration: 1.8, decimals: s.decimals ?? (Number.isInteger(s.value) ? 0 : 1), prefix: s.prefix ?? "", suffix: s.suffix ?? "" },
      });
      enter(num, "pop", t0 + 0.2, 0.6);
      const label = text(scene, slide, "label", s.label, cx, Math.max(y, H * 0.28) + size * 1.1, Math.round(size * 0.22), bodyColor, th.bodyFont, { align: "center", maxWidth: hasArt ? W * 0.55 : W * 0.8 });
      enter(label, "slideUp", t0 + 0.9, 0.6);
      done(t0 + 2.2);
      if (hasArt) art(spec.illustration, W * 0.64, H * 0.22, W * 0.3, H * 0.6, t0 + 0.5);
      break;
    }
    case "chart": {
      const y = heading(spec.title ?? "", W - m * 2);
      const c = spec.chart ?? { kind: "bar" as ChartKind, data: [] };
      const chart = obj<ChartObj>(scene, `${slide.id}_chart`, {
        type: "chart",
        kind: c.kind,
        data: c.data,
        x: m,
        y,
        w: W - m * 2,
        h: H * 0.92 - y,
        start: t0 + 0.4,
        duration: 1.8,
        colors: th.palette,
        textColor: bodyColor,
        font: th.bodyFont,
        unit: c.unit ?? "",
        showValues: true,
        slide: slide.id,
      } as Omit<ChartObj, "id" | "name" | "rotation" | "scale" | "opacity" | "tracks">);
      enter(chart, "fade", t0 + 0.2, 0.4);
      done(t0 + 2.4);
      break;
    }
    case "quote": {
      const q = spec.quote ?? { text: spec.body ?? "" };
      const size = Math.round(Math.min(H * 0.058, W * 0.042));
      const cardW = W * 0.78;
      const lines = linesFor(q.text, size, cardW - size * 3, th.headingFont === "anton" ? "poppins" : th.headingFont, true);
      const cardH = lines * size * 1.45 + size * 3.2 + (q.author ? size * 1.2 : 0);
      const cx = (W - cardW) / 2;
      const cy = H / 2 - cardH / 2;
      const card = drawing(scene, slide, "card", cx, cy, [{ kind: "rect", x: 0, y: 0, w: cardW, h: cardH, r: 24, fill: th.panel }]);
      enter(card, "zoom", t0, 0.6);
      const mark = text(scene, slide, "mark", "“", cx + size * 0.9, cy - size * 0.9, size * 3.2, th.accent, "abril");
      enter(mark, "pop", t0 + 0.3, 0.5);
      const qt = text(scene, slide, "quote", q.text, W / 2, cy + size * 1.5, size, th.heading, th.headingFont === "anton" ? "poppins" : th.headingFont, { align: "center", maxWidth: cardW - size * 3, lineHeight: 1.45, italic: true });
      enter(qt, "fade", t0 + 0.5, 0.8);
      if (q.author) {
        const au = text(scene, slide, "author", `- ${q.author}`, W / 2, cy + cardH - size * 1.7, Math.round(size * 0.6), th.accent, th.bodyFont, { align: "center" });
        enter(au, "slideUp", t0 + 1.1, 0.5);
      }
      done(t0 + 1.6);
      break;
    }
    case "steps": {
      const y = heading(spec.title ?? "", W - m * 2);
      const steps = (spec.steps ?? []).slice(0, 6);
      const n = Math.max(1, steps.length);
      const slot = (W - m * 2) / n;
      const r = Math.min(slot * 0.26, H * 0.09);
      const cy = y + (H * 0.92 - y) * 0.4;
      const line = drawing(scene, slide, "line", m + slot / 2, cy, [{ kind: "line", x1: 0, y1: 0, x2: slot * (n - 1), y2: 0, stroke: th.accent, width: Math.max(4, r * 0.12), dash: [r * 0.3, r * 0.25] }]);
      enter(line, "drawOn", t0 + 0.2, 0.3 + n * 0.25);
      steps.forEach((label, i) => {
        const at = speech > 0 ? t0 + 0.3 + (speech * 0.85 * i) / n : t0 + 0.4 + i * 0.5;
        const x = m + slot * i + slot / 2;
        const circle = drawing(scene, slide, `step${i + 1}`, x, cy, [
          { kind: "circle", cx: 0, cy: 0, r, fill: i % 2 ? th.accent2 : th.accent },
          { kind: "text", x: 0, y: -r * 0.62, text: String(i + 1), size: r * 1.1, font: th.headingFont, align: "center", fill: "#FFFFFF" },
        ]);
        enter(circle, "pop", at, 0.5);
        const size = Math.round(Math.min(H * 0.044, slot * 0.15));
        const tx = text(scene, slide, `steplabel${i + 1}`, label, x, cy + r + size * 0.8, size, bodyColor, th.bodyFont, { align: "center", maxWidth: slot * 0.9 });
        enter(tx, "slideUp", at + 0.15, 0.5);
        done(at + 0.65);
      });
      break;
    }
    case "comparison": {
      const y = heading(spec.title ?? "", W - m * 2);
      const cmp = spec.comparison ?? { leftTitle: "", left: [], rightTitle: "", right: [] };
      const gap = W * 0.04;
      const cardW = vertical ? W - m * 2 : (W - m * 2 - gap) / 2;
      const cardH = vertical ? (H * 0.94 - y - gap) / 2 : H * 0.93 - y;
      [0, 1].forEach((side) => {
        const cx = vertical ? m : m + side * (cardW + gap);
        const cy = vertical ? y + side * (cardH + gap) : y;
        const at = t0 + 0.2 + side * (speech > 0 ? speech * 0.45 : 0.8);
        const card = drawing(scene, slide, `card${side + 1}`, cx, cy, [
          { kind: "rect", x: 0, y: 0, w: cardW, h: cardH, r: 22, fill: th.panel },
          { kind: "rect", x: 0, y: 0, w: cardW, h: Math.max(6, H * 0.012), r: 4, fill: side ? th.accent2 : th.accent },
        ]);
        enter(card, "slideUp", at, 0.6);
        const size = Math.round(Math.min(H * 0.045, W * 0.032));
        const tt = text(scene, slide, `cardtitle${side + 1}`, side ? cmp.rightTitle : cmp.leftTitle, cx + size, cy + size * 0.9, size, th.heading, th.headingFont, { maxWidth: cardW - size * 2 });
        enter(tt, "fade", at + 0.2, 0.5);
        const items = side ? cmp.right : cmp.left;
        const isize = Math.round(size * 0.8);
        items.slice(0, 6).forEach((it, i) => {
          const iy = cy + size * 2.6 + i * isize * 1.9;
          const ia = at + 0.4 + i * 0.35;
          const icon: SvgObj = { id: uniqueId(scene, `${slide.id}_mark`), name: side ? "cross" : "check", x: cx + size, y: iy - isize * 0.1, rotation: 0, scale: 1, opacity: 1, tracks: {}, type: "svg", src: side ? "emoji:274c" : "emoji:2705", w: isize * 1.2, h: isize * 1.2, clock: ia, speed: 1, slide: slide.id };
          scene.objects.push(icon);
          enter(icon, "pop", ia, 0.4);
          const tx = text(scene, slide, `item${side + 1}_${i + 1}`, it, cx + size + isize * 1.7, iy, isize, bodyColor, th.bodyFont, { maxWidth: cardW - size * 2 - isize * 1.8 });
          enter(tx, "slideLeft", ia + 0.1, 0.4);
          done(ia + 0.5);
        });
      });
      break;
    }
  }
  return last;
}

function slides(scene: Scene): Slide[] {
  return scene.slides ?? [];
}

function pictureFromImage(scene: Scene, slide: Slide, asset: string, x: number, y: number, w: number, h: number): SceneObj {
  const img = { id: uniqueId(scene, `${slide.id}_photo`), name: "Picture", x, y, rotation: 0, scale: 1, opacity: 1, tracks: {}, type: "image" as const, asset, w, h, slide: slide.id, shape: "rounded" as const, shadow: true };
  scene.objects.push(img);
  return img;
}

// ── Keeping the timeline in order ───────────────────────────────────

/** Shift everything that happens at or after `from` by `dt` seconds (keys, clips, slides, words). */
export function shiftTimeline(scene: Scene, from: number, dt: number, only?: (o: SceneObj) => boolean) {
  if (!dt) return;
  const moveKeys = (tracks: Record<string, { t: number }[]>) => {
    for (const keys of Object.values(tracks)) for (const k of keys) if (k.t >= from - 1e-6 && k.t > 0) k.t = Math.max(0, k.t + dt);
  };
  const shiftWords = (words: Word[] | undefined) => {
    if (!words) return;
    for (const w of words) {
      if (w.start >= from - 1e-6) {
        w.start += dt;
        w.end += dt;
      }
    }
  };
  for (const o of scene.objects) {
    if (only && !only(o)) continue;
    moveKeys(o.tracks);
    if (o.links) for (const l of o.links) if (l.t >= from && l.t > 0) l.t += dt;
    if ((o.type === "video" || o.type === "audio") && o.start >= from - 1e-6) o.start = Math.max(0, o.start + dt);
    if (o.type === "audio") shiftWords(o.words);
    if (o.type === "caption") shiftWords(o.words);
    if (o.type === "svg" && o.clock >= from - 1e-6) o.clock += dt;
    if (o.type === "chart" && o.start >= from - 1e-6) o.start += dt;
    if (o.type === "text" && o.counter && o.counter.start >= from - 1e-6) o.counter.start += dt;
    if (o.type === "bubble" && o.audio && o.audio.at >= from - 1e-6) o.audio.at += dt;
    if (o.type === "sound" && o.at >= from - 1e-6) o.at += dt;
  }
  // The filter only picks which objects move; slides, markers and the camera always follow.
  moveKeys(scene.camera.tracks);
  for (const s of scene.slides ?? []) if (s.start >= from - 1e-6 && s.start > 0) s.start += dt;
  for (const mk of scene.markers ?? []) if (mk.t >= from) mk.t += dt;
  scene.duration = Math.max(0.5, Math.round((scene.duration + dt) * 10) / 10);
}

/** Change a slide's length, moving the slides after it. */
export function setSlideDuration(scene: Scene, slideId: string, duration: number) {
  const slide = scene.slides?.find((s) => s.id === slideId);
  if (!slide) throw new Error(`no slide "${slideId}"`);
  const dt = Math.max(1, duration) - slide.duration;
  if (Math.abs(dt) < 0.01) return;
  const end = slide.start + slide.duration;
  const before = slide.duration;
  shiftTimeline(scene, end, dt, (o) => o.slide !== slideId);
  slide.duration = Math.round((slide.duration + dt) * 100) / 100;
  if (slide.layout === "footage") stretchShots(scene, slide, before);
}

/** An AI video scene changed length: its footage shots stretch with it, so no shot ends early. */
function stretchShots(scene: Scene, slide: Slide, before: number) {
  const k = slide.duration / Math.max(0.1, before);
  const at = (t: number) => Math.round((slide.start + (t - slide.start) * k) * 1000) / 1000;
  for (const o of scene.objects) {
    if (o.slide !== slide.id || (o.type !== "video" && o.type !== "image")) continue;
    for (const name of ["scale", "x", "opacity"] as const) {
      const keys = o.tracks[name];
      if (keys) for (const key of keys) if (key.t > slide.start - 1e-6) key.t = at(key.t);
    }
    if (o.type === "video") {
      o.start = at(o.start);
      o.duration = Math.round(o.duration * k * 1000) / 1000;
      // The same stretch of source, played a little slower or faster.
      o.speed = Math.round(Math.max(0.5, Math.min(2, o.speed / k)) * 1000) / 1000;
    }
  }
}

/** Lengthen slides whose narration now runs past their end (after real voices are recorded). */
export function fitSlidesToNarration(scene: Scene): string[] {
  const changed: string[] = [];
  for (const slide of scene.slides ?? []) {
    const voices = scene.objects.filter((o): o is AudioObj => o.type === "audio" && o.slide === slide.id && o.role === "narration");
    if (!voices.length) continue;
    const end = Math.max(...voices.map((v) => v.start + v.duration));
    // AI video scenes fit their voice exactly (both ways); slides only grow, keeping a pause.
    if (slide.layout === "footage") {
      const fit = Math.round((end - slide.start + 0.35) * 100) / 100;
      if (Math.abs(fit - slide.duration) > 0.05) {
        setSlideDuration(scene, slide.id, fit);
        changed.push(slide.id);
      }
      continue;
    }
    const need = end - slide.start + 1;
    if (need > slide.duration + 0.05) {
      setSlideDuration(scene, slide.id, Math.round(need * 10) / 10);
      changed.push(slide.id);
    }
  }
  const last = scene.slides?.[scene.slides.length - 1];
  if (last) scene.duration = last.layout === "footage" ? Math.round((last.start + last.duration) * 1000) / 1000 : Math.max(scene.duration, Math.round((last.start + last.duration) * 10) / 10);
  if (changed.length) syncCaptions(scene);
  return changed;
}

/** Remove a slide, its objects, and close the gap. */
export function removeSlide(scene: Scene, slideId: string) {
  const slide = scene.slides?.find((s) => s.id === slideId);
  if (!slide) throw new Error(`no slide "${slideId}"`);
  scene.objects = scene.objects.filter((o) => o.slide !== slideId);
  scene.slides = scene.slides!.filter((s) => s.id !== slideId);
  shiftTimeline(scene, slide.start + slide.duration, -slide.duration);
  if (scene.slides.length) scene.slides[0].transition = { kind: "cut", duration: 0 };
  else delete scene.slides;
  syncCaptions(scene);
}

/** Captions that follow the narration: rebuilt from every narration clip's words. */
export function syncCaptions(scene: Scene) {
  const cap = scene.objects.find((o) => o.type === "caption" && o.source === "narration");
  if (!cap || cap.type !== "caption") return;
  cap.words = scene.objects
    .filter((o): o is AudioObj => o.type === "audio" && o.role === "narration" && !o.hidden)
    .flatMap((o) => o.words ?? [])
    .sort((a, b) => a.start - b.start)
    .map((w) => ({ ...w }));
}
