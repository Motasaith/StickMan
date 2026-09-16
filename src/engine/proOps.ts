// Editor ops for media, stickers, illustrations, captions, regions, charts and presentations.
// They join the main op list in ops.ts; the AI and the editor's panels use the same ones.

import { z } from "zod";
import type { Asset, AudioObj, Background, CaptionObj, ChartObj, RegionObj, Scene, SceneObj, SvgObj, TextObj, VideoObj, Word } from "./scene";
import { AUDIO_ROLES, CAPTION_STYLES, CHART_KINDS, COLOR_LOOKS, FONTS, LOOPS, REGION_KINDS, TEXT_STYLES, TRANSITIONS, VOICE_IDS, findObj, uniqueId } from "./scene";
import { ENTER_KINDS, EXIT_KINDS, enter, exit } from "./entrances";
import { findIllustration, ILLUSTRATIONS } from "./illustrations";
import { findSticker } from "./stickers";
import { cleanSvgMarkup, svgProblem } from "./svg";
import { estimateWords } from "./media";
import { THEME_IDS, themeById } from "./themes";
import { SLIDE_LAYOUTS, addSlide, fitSlidesToNarration, removeSlide, setSlideDuration, speechSeconds, syncCaptions, type SlideSpec } from "./slides";
import { worldState } from "./render";

export type ProAssetInfo = Pick<Asset, "id" | "name" | "w" | "h" | "kind" | "duration" | "hasAudio">;

const num = z.number().finite();
const time = z.number().finite().min(0).max(3600);
const color = z.string().max(40);
const id = z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, "ids use letters, digits, _ and -");
const size = z.number().min(1).max(8000);

const adjustSchema = z.object({
  brightness: z.number().min(-100).max(100).optional(),
  contrast: z.number().min(-100).max(100).optional(),
  saturation: z.number().min(-100).max(100).optional(),
  warmth: z.number().min(-100).max(100).optional(),
  blur: z.number().min(0).max(50).optional(),
});

const backgroundSchema = z.union([
  z.object({ kind: z.literal("color"), color }),
  z.object({ kind: z.literal("gradient"), from: color, to: color, angle: num.default(135), radial: z.boolean().optional() }),
  z.object({ kind: z.literal("image"), asset: z.string().max(80), dim: z.number().min(0).max(0.9).optional() }),
]);

const slideSpecSchema = z.object({
  id: id.optional(),
  layout: z.enum(SLIDE_LAYOUTS),
  title: z.string().max(160).optional(),
  subtitle: z.string().max(240).optional(),
  body: z.string().max(600).optional(),
  bullets: z.array(z.string().max(160)).max(8).optional(),
  illustration: z.string().max(80).optional(),
  image: z.string().max(80).optional(),
  stat: z.object({ value: num, label: z.string().max(120), prefix: z.string().max(4).optional(), suffix: z.string().max(8).optional(), decimals: z.number().int().min(0).max(3).optional() }).optional(),
  chart: z.object({ kind: z.enum(CHART_KINDS), data: z.array(z.object({ label: z.string().max(40), value: num })).min(1).max(12), unit: z.string().max(8).optional() }).optional(),
  quote: z.object({ text: z.string().max(300), author: z.string().max(80).optional() }).optional(),
  steps: z.array(z.string().max(60)).max(6).optional(),
  comparison: z.object({ leftTitle: z.string().max(40), left: z.array(z.string().max(80)).max(6), rightTitle: z.string().max(40), right: z.array(z.string().max(80)).max(6) }).optional(),
  narration: z.string().max(1200).optional(),
  voice: z.enum(VOICE_IDS).optional(),
  duration: z.number().min(1).max(120).optional(),
  transition: z.enum(TRANSITIONS).optional(),
  background: backgroundSchema.optional(),
});

const appearFields = {
  at: time.optional(),
  /** When it leaves (hidden after). */
  until: time.optional(),
  enter: z.enum(ENTER_KINDS).optional(),
  exit: z.enum(EXIT_KINDS).optional(),
  loop: z.enum(LOOPS).optional(),
};

export const proOpSchemas = [
  z.object({ op: z.literal("sticker"), id, emoji: z.string().min(1).max(40), x: num, y: num, size: size.optional(), rotation: num.optional(), ...appearFields }),
  z.object({
    op: z.literal("illustration"),
    id,
    name: z.string().min(1).max(80),
    x: num,
    y: num,
    w: size.optional(),
    h: size.optional(),
    colors: z.record(z.string().max(20), color).optional(),
    speed: z.number().min(0).max(4).optional(),
    ...appearFields,
  }),
  z.object({ op: z.literal("svg"), id, name: z.string().max(60).optional(), svg: z.string().min(20).max(60000), x: num, y: num, w: size, h: size, ...appearFields }),
  /** Keep an SVG as an asset without placing it (slides then use "asset:<id>"). */
  z.object({ op: z.literal("svgAsset"), id, name: z.string().max(60).optional(), svg: z.string().min(20).max(60000) }),
  z.object({
    op: z.literal("video"),
    id,
    asset: z.string().max(80),
    x: num.optional(),
    y: num.optional(),
    w: size.optional(),
    h: size.optional(),
    fit: z.enum(["cover", "contain", "free"]).optional(),
    start: time.optional(),
    in: z.number().min(0).max(36000).optional(),
    duration: z.number().min(0.1).max(3600).optional(),
    speed: z.number().min(0.25).max(4).optional(),
    volume: z.number().min(0).max(2).optional(),
  }),
  z.object({
    op: z.literal("audio"),
    id,
    asset: z.string().max(80),
    role: z.enum(AUDIO_ROLES).optional(),
    start: time.optional(),
    in: z.number().min(0).max(36000).optional(),
    duration: z.number().min(0.1).max(3600).optional(),
    volume: z.number().min(0).max(2).optional(),
    fadeIn: z.number().min(0).max(10).optional(),
    fadeOut: z.number().min(0).max(10).optional(),
  }),
  z.object({ op: z.literal("trim"), id, start: time.optional(), in: z.number().min(0).max(36000).optional(), duration: z.number().min(0.1).max(3600).optional() }),
  z.object({ op: z.literal("split"), id, at: time }),
  z.object({ op: z.literal("detachAudio"), id }),
  z.object({ op: z.literal("narrate"), id: id.optional(), text: z.string().min(1).max(3000), voice: z.enum(VOICE_IDS).optional(), at: time, speaker: id.optional(), captions: z.boolean().optional() }),
  z.object({
    op: z.literal("captions"),
    id: id.optional(),
    from: z.string().max(40).optional(),
    style: z.enum(CAPTION_STYLES).optional(),
    position: z.enum(["top", "middle", "bottom"]).optional(),
    font: z.enum(FONTS).optional(),
    size: z.number().min(10).max(200).optional(),
    color: color.optional(),
    accent: color.optional(),
    maxChars: z.number().int().min(8).max(80).optional(),
  }),
  z.object({
    op: z.literal("region"),
    id,
    kind: z.enum(REGION_KINDS),
    x: num,
    y: num,
    w: size,
    h: size,
    shape: z.enum(["rect", "ellipse"]).optional(),
    strength: z.number().min(1).max(100).optional(),
    color: color.optional(),
    follow: id.optional(),
    at: time.optional(),
    until: time.optional(),
  }),
  z.object({
    op: z.literal("chart"),
    id,
    kind: z.enum(CHART_KINDS),
    data: z.array(z.object({ label: z.string().max(40), value: num, color: color.optional() })).min(1).max(20),
    x: num,
    y: num,
    w: size,
    h: size,
    at: time.optional(),
    duration: z.number().min(0).max(30).optional(),
    unit: z.string().max(8).optional(),
    textColor: color.optional(),
    font: z.enum(FONTS).optional(),
    colors: z.array(color).max(12).optional(),
  }),
  z.object({
    op: z.literal("counter"),
    id,
    to: num,
    from: num.optional(),
    x: num,
    y: num,
    size: z.number().min(8).max(600).optional(),
    color: color.optional(),
    font: z.enum(FONTS).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    prefix: z.string().max(6).optional(),
    suffix: z.string().max(10).optional(),
    decimals: z.number().int().min(0).max(3).optional(),
    at: time.optional(),
    duration: z.number().min(0).max(30).optional(),
  }),
  z.object({
    op: z.literal("heading"),
    id,
    text: z.string().min(1).max(400),
    x: num.optional(),
    y: num.optional(),
    size: z.number().min(8).max(400).optional(),
    style: z.enum(TEXT_STYLES).optional(),
    font: z.enum(FONTS).optional(),
    color: color.optional(),
    accent: color.optional(),
    subtext: z.string().max(200).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    maxWidth: size.optional(),
    ...appearFields,
  }),
  z.object({ op: z.literal("enter"), id, kind: z.enum(ENTER_KINDS), at: time, duration: z.number().min(0.05).max(10).optional() }),
  z.object({ op: z.literal("exit"), id, kind: z.enum(EXIT_KINDS), at: time, duration: z.number().min(0.05).max(10).optional() }),
  z.object({ op: z.literal("loop"), id, kind: z.enum(LOOPS), amount: z.number().min(0.1).max(5).optional() }),
  z.object({ op: z.literal("grade"), look: z.string().max(20).optional(), ...adjustSchema.shape }),
  z.object({ op: z.literal("marker"), at: time, label: z.string().max(60), color: color.optional() }),
  z.object({
    op: z.literal("background"),
    color: color.optional(),
    gradient: z.object({ from: color, to: color, angle: num.optional(), radial: z.boolean().optional() }).optional(),
    image: z.string().max(80).optional(),
    dim: z.number().min(0).max(0.9).optional(),
    slide: id.optional(),
  }),
  z.object({
    op: z.literal("presentation"),
    title: z.string().max(160).optional(),
    theme: z.enum(THEME_IDS).optional(),
    voice: z.enum(VOICE_IDS).optional(),
    captions: z.union([z.boolean(), z.enum(CAPTION_STYLES)]).optional(),
    format: z.enum(["16:9", "9:16", "1:1"]).optional(),
    slides: z.array(slideSpecSchema).min(1).max(40),
  }),
  slideSpecSchema.extend({ op: z.literal("slide"), theme: z.enum(THEME_IDS).optional() }),
  z.object({
    op: z.literal("updateSlide"),
    id,
    title: z.string().max(160).optional(),
    duration: z.number().min(1).max(120).optional(),
    background: backgroundSchema.optional(),
    transition: z.enum(TRANSITIONS).optional(),
    transitionDuration: z.number().min(0).max(3).optional(),
    notes: z.string().max(1200).optional(),
  }),
  z.object({ op: z.literal("removeSlide"), id }),
  z.object({ op: z.literal("theme"), theme: z.enum(THEME_IDS) }),
  z.object({
    op: z.literal("edit"),
    id,
    set: z
      .object({
        loop: z.enum(LOOPS),
        loopAmount: z.number().min(0.1).max(5),
        pivot: z.enum(["center"]).nullable(),
        locked: z.boolean(),
        hidden: z.boolean(),
        adjust: adjustSchema,
        look: z.string().max(20),
        shape: z.enum(["rect", "rounded", "circle"]),
        border: z.object({ width: z.number().min(0).max(60), color }).nullable(),
        shadow: z.boolean(),
        crop: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0.01).max(1), h: z.number().min(0.01).max(1) }).nullable(),
        flipX: z.boolean(),
        chroma: z.object({ color, similarity: z.number().min(0.01).max(0.5), smoothness: z.number().min(0).max(0.3) }).nullable(),
        style: z.enum(TEXT_STYLES),
        accent: color,
        subtext: z.string().max(200),
        maxWidth: size.nullable(),
        italic: z.boolean(),
        letterSpacing: z.number().min(-10).max(60),
        lineHeight: z.number().min(0.6).max(3),
        align: z.enum(["left", "center", "right"]),
        colors: z.record(z.string().max(20), color),
        speed: z.number().min(0).max(4),
        clock: time,
        volume: z.number().min(0).max(2),
        fadeIn: z.number().min(0).max(10),
        fadeOut: z.number().min(0).max(10),
        reverse: z.boolean(),
        freeze: z.number().min(0).max(30),
        text: z.string().max(3000),
        voice: z.enum(VOICE_IDS),
        role: z.enum(AUDIO_ROLES),
        strength: z.number().min(1).max(100),
        kind: z.string().max(20),
        position: z.enum(["top", "middle", "bottom"]),
        maxChars: z.number().int().min(8).max(80),
        captionStyle: z.enum(CAPTION_STYLES),
        size: z.number().min(4).max(600),
        font: z.enum(FONTS),
        color,
        textColor: color,
        unit: z.string().max(8),
        showValues: z.boolean(),
        data: z.array(z.object({ label: z.string().max(40), value: num, color: color.optional() })).min(1).max(20),
        w: size,
        h: size,
      })
      .partial(),
  }),
] as const;

type ProSchema = (typeof proOpSchemas)[number];
export type ProOp = z.infer<ProSchema>;
export const PRO_OP_NAMES = new Set<string>(proOpSchemas.map((s) => (s.shape.op as z.ZodLiteral<string>).value));

export interface ProContext {
  assets: ProAssetInfo[];
  /** Assets the ops made (AI-drawn SVGs), for the editor to keep. */
  newAssets: Asset[];
}

const base = (objId: string, name: string, x: number, y: number) => ({ id: objId, name, x, y, rotation: 0, scale: 1, opacity: 1, tracks: {} });

function need(scene: Scene, objId: string): SceneObj {
  const o = findObj(scene, objId);
  if (!o) throw new Error(`no object with id "${objId}"`);
  return o;
}

function put(scene: Scene, obj: SceneObj): string {
  const i = scene.objects.findIndex((o) => o.id === obj.id);
  if (i >= 0) {
    scene.objects[i] = obj;
    return "replaced";
  }
  scene.objects.push(obj);
  return "added";
}

function findMedia(assets: ProAssetInfo[], ref: string, kind: "video" | "audio" | "image") {
  const lower = ref.toLowerCase();
  const a = assets.find((x) => x.id === ref) ?? assets.find((x) => x.name.toLowerCase() === lower);
  if (!a) throw new Error(`no imported ${kind} called "${ref}"`);
  if (kind === "video" && a.kind !== "video") throw new Error(`"${ref}" is not a video`);
  if (kind === "audio" && a.kind !== "audio" && a.kind !== "video") throw new Error(`"${ref}" is not audio`);
  return a;
}

/** Show from `at` (with an entrance), leave at `until` (with an exit), and loop. */
function appearance(obj: SceneObj, o: { at?: number; until?: number; enter?: (typeof ENTER_KINDS)[number]; exit?: (typeof EXIT_KINDS)[number]; loop?: (typeof LOOPS)[number] }) {
  if (o.enter) enter(obj, o.enter, o.at ?? 0);
  else if (o.at && o.at > 0) obj.tracks.opacity = [{ t: 0, v: 0 }, { t: o.at, v: 1, e: "step" }];
  if (o.until !== undefined) {
    if (o.exit) exit(obj, o.exit, o.until);
    else {
      const keys = (obj.tracks.opacity ??= [{ t: 0, v: 1 }]);
      keys.push({ t: o.until, v: 0, e: "step" });
      keys.sort((a, b) => a.t - b.t);
    }
  }
  if (o.loop) obj.loop = o.loop;
}

const fmt = (t: number) => (Math.round(t * 10) / 10).toString();

export function applyProOp(scene: Scene, op: ProOp, ctx: ProContext): string {
  switch (op.op) {
    case "sticker": {
      const st = findSticker(op.emoji);
      if (!st) throw new Error(`no sticker for "${op.emoji}". Use an emoji character or a name like "thumbs up", "fire", "star", "check mark", "heart"`);
      const s = op.size ?? 160;
      const obj: SvgObj = { ...base(op.id, st.name, op.x, op.y), type: "svg", src: `emoji:${st.code}`, w: s, h: s, clock: op.at ?? 0, speed: 1, pivot: "center" };
      if (op.rotation) obj.rotation = op.rotation;
      appearance(obj, op);
      return `${put(scene, obj)} ${st.char} sticker`;
    }
    case "illustration": {
      const ill = findIllustration(op.name);
      if (!ill) {
        const words = op.name.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
        const close = ILLUSTRATIONS.filter((i) => words.some((w) => i.tags.includes(w.slice(0, 4)))).slice(0, 6).map((i) => i.id);
        throw new Error(`no library illustration for "${op.name}"${close.length ? `; similar: ${close.join(", ")}` : ""}. Draw one with {"op":"svg",...} instead`);
      }
      const w = op.w ?? op.h ?? 320;
      const h = op.h ?? w;
      const obj: SvgObj = { ...base(op.id, ill.name, op.x, op.y), type: "svg", src: `lib:${ill.id}`, w, h, clock: op.at ?? 0, speed: op.speed ?? 1, pivot: "center" };
      if (op.colors) obj.colors = op.colors;
      appearance(obj, op);
      return `${put(scene, obj)} "${ill.name}" illustration`;
    }
    case "svg": {
      const markup = cleanSvgMarkup(op.svg);
      const problem = svgProblem(markup);
      if (problem) throw new Error(`that SVG can't be used: ${problem}`);
      const assetId = `svg_${op.id}`;
      ctx.newAssets.push({ id: assetId, name: op.name ?? op.id, src: "", w: op.w, h: op.h, kind: "svg", svg: markup, origin: "ai" });
      const obj: SvgObj = { ...base(op.id, op.name ?? op.id, op.x, op.y), type: "svg", src: `asset:${assetId}`, w: op.w, h: op.h, clock: op.at ?? 0, speed: 1, pivot: "center" };
      appearance(obj, op);
      return `${put(scene, obj)} drawing "${obj.name}"`;
    }
    case "svgAsset": {
      const markup = cleanSvgMarkup(op.svg);
      const problem = svgProblem(markup);
      if (problem) throw new Error(`that SVG can't be used: ${problem}`);
      ctx.newAssets.push({ id: op.id, name: op.name ?? op.id, src: "", w: 400, h: 400, kind: "svg", svg: markup, origin: "ai" });
      ctx.assets.push({ id: op.id, name: op.name ?? op.id, w: 400, h: 400, kind: "svg" });
      return `drew "${op.name ?? op.id}"`;
    }
    case "video": {
      const a = findMedia(ctx.assets, op.asset, "video");
      const speed = op.speed ?? 1;
      const srcIn = op.in ?? 0;
      const total = a.duration ?? 10;
      const duration = op.duration ?? Math.max(0.1, (total - srcIn) / speed);
      const fit = op.fit ?? (op.w || op.h ? "free" : "cover");
      const W = scene.width;
      const H = scene.height;
      const aspect = a.w && a.h ? a.w / a.h : 16 / 9;
      let x = op.x ?? 0;
      let y = op.y ?? 0;
      let w = op.w ?? W;
      let h = op.h ?? (op.w ? op.w / aspect : H);
      let crop: VideoObj["crop"] = null;
      if (fit === "cover") {
        x = 0;
        y = 0;
        w = W;
        h = H;
        const box = W / H;
        if (aspect > box) {
          const cw = box / aspect;
          crop = { x: (1 - cw) / 2, y: 0, w: cw, h: 1 };
        } else if (aspect < box) {
          const ch = aspect / box;
          crop = { x: 0, y: (1 - ch) / 2, w: 1, h: ch };
        }
      } else if (fit === "contain") {
        const k = Math.min(W / aspect, H);
        h = k;
        w = k * aspect;
        x = (W - w) / 2;
        y = (H - h) / 2;
      }
      const obj: VideoObj = {
        ...base(op.id, a.name, x, y),
        type: "video",
        asset: a.id,
        w,
        h,
        start: op.start ?? 0,
        duration,
        in: srcIn,
        speed,
        volume: op.volume ?? (a.hasAudio === false ? 0 : 1),
        fadeIn: 0,
        fadeOut: 0,
        crop,
      };
      const verb = put(scene, obj);
      if (obj.start + duration > scene.duration) scene.duration = Math.round((obj.start + duration) * 10) / 10;
      return `${verb} video "${a.name}" (${fmt(obj.start)}s to ${fmt(obj.start + duration)}s)`;
    }
    case "audio": {
      const a = findMedia(ctx.assets, op.asset, "audio");
      const srcIn = op.in ?? 0;
      const duration = op.duration ?? Math.max(0.1, (a.duration ?? 5) - srcIn);
      const obj: AudioObj = {
        ...base(op.id, a.name, 0, 0),
        type: "audio",
        asset: a.id,
        role: op.role ?? "voiceover",
        start: op.start ?? 0,
        duration,
        in: srcIn,
        speed: 1,
        volume: op.volume ?? 1,
        fadeIn: op.fadeIn ?? 0,
        fadeOut: op.fadeOut ?? 0,
      };
      const verb = put(scene, obj);
      if (obj.start + duration > scene.duration) scene.duration = Math.round((obj.start + duration) * 10) / 10;
      return `${verb} ${obj.role} "${a.name}" at ${fmt(obj.start)}s`;
    }
    case "trim": {
      const o = need(scene, op.id);
      if (o.type !== "video" && o.type !== "audio") throw new Error(`"${op.id}" is a ${o.type}; only video and audio clips trim`);
      if (op.in !== undefined) o.in = op.in;
      if (op.start !== undefined) o.start = op.start;
      if (op.duration !== undefined) o.duration = op.duration;
      return `trimmed ${op.id} to ${fmt(o.start)}s to ${fmt(o.start + o.duration)}s`;
    }
    case "split": {
      const o = need(scene, op.id);
      if (o.type !== "video" && o.type !== "audio") throw new Error(`"${op.id}" is a ${o.type}; only video and audio clips split`);
      const local = op.at - o.start;
      if (local <= 0.05 || local >= o.duration - 0.05) throw new Error(`${op.at}s is not inside ${op.id} (${fmt(o.start)}s to ${fmt(o.start + o.duration)}s)`);
      const second = structuredClone(o) as typeof o;
      second.id = uniqueId(scene, `${o.id}_b`);
      second.name = `${o.name} (2)`;
      second.start = op.at;
      second.duration = o.duration - local;
      second.in = o.type === "video" && o.reverse ? o.in : o.in + local * o.speed;
      if (o.type === "video" && o.reverse) o.in = o.in + second.duration * o.speed;
      o.duration = local;
      if (o.type === "audio" && o.words) {
        second.type === "audio" && (second.words = o.words.filter((w) => w.start >= op.at));
        o.words = o.words.filter((w) => w.start < op.at);
      }
      scene.objects.splice(scene.objects.indexOf(o) + 1, 0, second);
      return `split ${op.id} at ${fmt(op.at)}s (new clip ${second.id})`;
    }
    case "detachAudio": {
      const o = need(scene, op.id);
      if (o.type !== "video") throw new Error(`"${op.id}" is not a video`);
      const a: AudioObj = { ...base(uniqueId(scene, `${o.id}_sound`), `${o.name} sound`, 0, 0), type: "audio", asset: o.asset, role: "sound", start: o.start, duration: o.duration, in: o.in, speed: o.speed, volume: o.volume || 1, fadeIn: o.fadeIn, fadeOut: o.fadeOut };
      o.volume = 0;
      scene.objects.push(a);
      return `detached the sound of ${op.id} as ${a.id}`;
    }
    case "narrate": {
      const dur = speechSeconds(op.text);
      const obj: AudioObj = {
        ...base(op.id ?? uniqueId(scene, "narration"), `Narration: ${op.text.slice(0, 24)}`, 0, 0),
        type: "audio",
        asset: null,
        role: "narration",
        start: op.at,
        duration: dur,
        in: 0,
        speed: 1,
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        text: op.text,
        voice: op.voice ?? "narrator",
        words: estimateWords(op.text, op.at, dur),
        speaker: op.speaker ?? null,
      };
      const verb = put(scene, obj);
      if (op.captions) ensureCaptions(scene, "narration");
      syncCaptions(scene);
      if (op.at + dur > scene.duration) scene.duration = Math.round((op.at + dur + 0.5) * 10) / 10;
      return `${verb} narration "${op.text.slice(0, 30)}" at ${fmt(op.at)}s`;
    }
    case "captions": {
      const from = op.from ?? "narration";
      const cap = ensureCaptions(scene, from, op.id);
      if (op.style) cap.style = op.style;
      if (op.position) cap.position = op.position;
      if (op.font) cap.font = op.font;
      if (op.size) cap.size = op.size;
      if (op.color) cap.color = op.color;
      if (op.accent) cap.accent = op.accent;
      if (op.maxChars) cap.maxChars = op.maxChars;
      if (!cap.words.length) throw new Error(from === "narration" ? "there is no narration to caption yet; add narration first" : `"${from}" has no timed words to caption`);
      return `captions (${cap.style}) for ${from}, ${cap.words.length} words`;
    }
    case "region": {
      const obj: RegionObj = {
        ...base(op.id, `${op.kind}`, op.x, op.y),
        type: "region",
        kind: op.kind,
        w: op.w,
        h: op.h,
        shape: op.shape ?? (op.kind === "spotlight" ? "ellipse" : "rect"),
        strength: op.strength ?? (op.kind === "blur" ? 14 : op.kind === "pixelate" ? 16 : op.kind === "spotlight" ? 60 : op.kind === "magnify" ? 20 : 6),
        color: op.color ?? (op.kind === "highlight" ? "#FFC857" : op.kind === "redact" ? "#000000" : "#FFFFFF"),
      };
      if (op.follow) {
        const parent = need(scene, op.follow);
        const at = op.at ?? 0;
        const p = worldState(scene, parent, at);
        obj.x = op.x - p.x;
        obj.y = op.y - p.y;
        obj.links = [{ t: 0, parent: parent.id, anchor: "origin", follow: "position" }];
      }
      appearance(obj, op);
      return `${put(scene, obj)} ${op.kind} area${op.follow ? ` following ${op.follow}` : ""}`;
    }
    case "chart": {
      const obj: ChartObj = {
        ...base(op.id, `${op.kind} chart`, op.x, op.y),
        type: "chart",
        kind: op.kind,
        data: op.data,
        w: op.w,
        h: op.h,
        start: op.at ?? 0,
        duration: op.duration ?? 1.8,
        colors: op.colors ?? themeById(scene.theme).palette,
        textColor: op.textColor ?? "#2B2D42",
        font: op.font ?? "poppins",
        unit: op.unit ?? "",
        showValues: true,
      };
      if (op.at && op.at > 0) obj.tracks.opacity = [{ t: 0, v: 0 }, { t: op.at, v: 1, e: "step" }];
      return `${put(scene, obj)} ${op.kind} chart of ${op.data.length} values`;
    }
    case "counter": {
      const at = op.at ?? 0;
      const obj: TextObj = {
        ...base(op.id, "Counter", op.x, op.y),
        type: "text",
        text: `${op.prefix ?? ""}${op.to}${op.suffix ?? ""}`,
        size: op.size ?? 120,
        color: op.color ?? "#1a1a1a",
        font: op.font ?? "poppins",
        align: op.align ?? "center",
        bold: true,
        counter: { from: op.from ?? 0, to: op.to, start: at, duration: op.duration ?? 1.8, decimals: op.decimals ?? 0, prefix: op.prefix ?? "", suffix: op.suffix ?? "" },
      };
      if (at > 0) obj.tracks.opacity = [{ t: 0, v: 0 }, { t: at, v: 1, e: "step" }];
      return `${put(scene, obj)} counter to ${op.to}`;
    }
    case "heading": {
      const style = op.style ?? "shadow";
      const lower = style === "lowerThird";
      const obj: TextObj = {
        ...base(op.id, op.text.slice(0, 24), op.x ?? (lower ? scene.width * 0.06 : scene.width / 2), op.y ?? (lower ? scene.height * 0.72 : scene.height * 0.12)),
        type: "text",
        text: op.text,
        size: op.size ?? (lower ? 44 : 72),
        color: op.color ?? (style === "box" || lower ? "#FFFFFF" : "#1a1a1a"),
        font: op.font ?? "poppins",
        align: op.align ?? (lower ? "left" : "center"),
        bold: true,
        style,
      };
      if (op.accent) obj.accent = op.accent;
      if (op.subtext) obj.subtext = op.subtext;
      if (op.maxWidth) obj.maxWidth = op.maxWidth;
      appearance(obj, { ...op, enter: op.enter ?? (lower ? "slideRight" : undefined) });
      return `${put(scene, obj)} ${style} text "${op.text.slice(0, 30)}"`;
    }
    case "enter": {
      const o = need(scene, op.id);
      enter(o, op.kind, op.at, op.duration);
      return `${op.id} enters (${op.kind}) at ${fmt(op.at)}s`;
    }
    case "exit": {
      const o = need(scene, op.id);
      exit(o, op.kind, op.at, op.duration);
      return `${op.id} leaves (${op.kind}) by ${fmt(op.at)}s`;
    }
    case "loop": {
      const o = need(scene, op.id);
      o.loop = op.kind;
      if (op.amount !== undefined) o.loopAmount = op.amount;
      return op.kind === "none" ? `${op.id} stops looping` : `${op.id} loops (${op.kind})`;
    }
    case "grade": {
      if (op.look === "natural" || op.look === "none") {
        scene.grade = null;
        return "removed the color grade";
      }
      const preset = op.look ? COLOR_LOOKS.find((l) => l.id === op.look) : undefined;
      if (op.look && !preset) throw new Error(`no look "${op.look}"; looks: ${COLOR_LOOKS.map((l) => l.id).join(", ")}`);
      const g = { ...(preset?.adjust ?? scene.grade ?? { brightness: 0, contrast: 0, saturation: 0, warmth: 0 }) };
      for (const k of ["brightness", "contrast", "saturation", "warmth", "blur"] as const) if (op[k] !== undefined) g[k] = op[k]!;
      scene.grade = g;
      return `color grade ${op.look ?? "adjusted"}`;
    }
    case "marker": {
      (scene.markers ??= []).push({ t: op.at, label: op.label, color: op.color });
      scene.markers.sort((a, b) => a.t - b.t);
      return `marker "${op.label}" at ${fmt(op.at)}s`;
    }
    case "background": {
      const bg: Background | null = op.gradient
        ? { kind: "gradient", from: op.gradient.from, to: op.gradient.to, angle: op.gradient.angle ?? 135, radial: op.gradient.radial }
        : op.image
          ? { kind: "image", asset: op.image, dim: op.dim }
          : op.color
            ? { kind: "color", color: op.color }
            : null;
      if (!bg) throw new Error("give a color, gradient or image");
      if (op.slide) {
        const s = scene.slides?.find((x) => x.id === op.slide);
        if (!s) throw new Error(`no slide "${op.slide}"`);
        s.background = bg;
        return `slide ${op.slide} background changed`;
      }
      if (bg.kind === "color") {
        scene.background = bg.color;
        scene.backgroundFill = null;
      } else scene.backgroundFill = bg;
      return "background changed";
    }
    case "presentation": {
      clearPresentation(scene);
      if (op.format) {
        const [w, h] = op.format === "9:16" ? [1080, 1920] : op.format === "1:1" ? [1080, 1080] : [scene.width >= scene.height ? scene.width : 1280, scene.width >= scene.height ? scene.height : 720];
        scene.width = w;
        scene.height = h;
        scene.ground = Math.round(h * 0.86);
      }
      const theme = themeById(op.theme ?? scene.theme);
      scene.theme = theme.id;
      if (op.title) scene.title = op.title;
      scene.background = theme.background.kind === "color" ? theme.background.color : "#ffffff";
      const notes: string[] = [];
      for (const spec of op.slides) {
        const r = addSlide(scene, { ...spec, voice: spec.voice ?? op.voice } as SlideSpec, theme.id);
        (r.slide as { spec?: unknown }).spec = spec;
        notes.push(...r.messages);
      }
      if (op.captions) {
        const cap = ensureCaptions(scene, "narration");
        cap.style = typeof op.captions === "string" ? op.captions : "box";
        syncCaptions(scene);
      }
      const last = scene.slides![scene.slides!.length - 1];
      scene.duration = Math.round((last.start + last.duration) * 10) / 10;
      return `built a ${op.slides.length}-slide presentation (${theme.label} theme, ${fmt(scene.duration)}s)${notes.length ? `. Note: ${notes.join("; ")}` : ""}`;
    }
    case "slide": {
      const { op: _op, theme, ...spec } = op;
      void _op;
      const r = addSlide(scene, spec as SlideSpec, theme);
      (r.slide as { spec?: unknown }).spec = spec;
      return `added slide ${r.slide.id} (${spec.layout}, ${fmt(r.slide.start)}s to ${fmt(r.slide.start + r.slide.duration)}s)${r.messages.length ? `. Note: ${r.messages.join("; ")}` : ""}`;
    }
    case "updateSlide": {
      const s = scene.slides?.find((x) => x.id === op.id);
      if (!s) throw new Error(`no slide "${op.id}"; slides: ${(scene.slides ?? []).map((x) => x.id).join(", ") || "none"}`);
      if (op.title !== undefined) s.title = op.title;
      if (op.background) s.background = op.background as Background;
      if (op.transition) s.transition = { kind: op.transition, duration: op.transitionDuration ?? (s.transition.duration || 0.7) };
      else if (op.transitionDuration !== undefined) s.transition.duration = op.transitionDuration;
      if (op.notes !== undefined) s.notes = op.notes;
      if (op.duration !== undefined) setSlideDuration(scene, s.id, op.duration);
      return `updated slide ${op.id}`;
    }
    case "removeSlide": {
      removeSlide(scene, op.id);
      return `removed slide ${op.id}`;
    }
    case "theme": {
      const specs = (scene.slides ?? []).map((s) => (s as { spec?: SlideSpec }).spec);
      if (!specs.length || specs.some((s) => !s)) {
        scene.theme = op.theme;
        return `theme set to ${op.theme} (applies to new slides)`;
      }
      rebuildWithTheme(scene, op.theme, specs as SlideSpec[]);
      return `restyled the presentation with the ${themeById(op.theme).label} theme`;
    }
    case "edit":
      return editObject(scene, op.id, op.set);
  }
}

function ensureCaptions(scene: Scene, from: string, wantedId?: string): CaptionObj {
  let cap = scene.objects.find((o): o is CaptionObj => o.type === "caption" && o.source === from);
  if (!cap) {
    cap = {
      ...base(wantedId ?? uniqueId(scene, "captions"), "Captions", 0, 0),
      type: "caption",
      words: [],
      source: from,
      style: "box",
      position: "bottom",
      font: "poppins",
      size: Math.round(Math.min(scene.width, scene.height) * 0.05),
      color: "#FFFFFF",
      accent: "#FFC857",
      maxChars: scene.height > scene.width ? 22 : 40,
    };
    scene.objects.push(cap);
  }
  if (from === "narration") syncCaptions(scene);
  else if (from === "bubbles") cap.words = bubbleWords(scene);
  else {
    const src = findObj(scene, from);
    if (!src) throw new Error(`no object with id "${from}"`);
    if (src.type === "audio") cap.words = (src.words ?? []).map((w) => ({ ...w }));
    else if (src.type !== "video") throw new Error(`"${from}" is a ${src.type}; captions come from narration, audio, video or "bubbles"`);
  }
  return cap;
}

function bubbleWords(scene: Scene): Word[] {
  return scene.objects.flatMap((o) => {
    if (o.type !== "bubble") return [];
    const at = o.audio?.at ?? o.tracks.opacity?.find((k) => k.v > 0.5)?.t ?? 0;
    const dur = o.audio?.duration ?? speechSeconds(o.text);
    return estimateWords(o.text, at, dur);
  });
}

/** Take away the current slides and everything on them, and their narration. */
function clearPresentation(scene: Scene) {
  const ids = new Set((scene.slides ?? []).map((s) => s.id));
  scene.objects = scene.objects.filter((o) => !(o.slide && ids.has(o.slide)) && !(o.type === "caption" && o.source === "narration"));
  delete scene.slides;
}

function rebuildWithTheme(scene: Scene, themeId: string, specs: SlideSpec[]) {
  const old = scene.objects.filter((o): o is AudioObj => o.type === "audio" && o.role === "narration" && !!o.slide);
  const oldSlides = scene.slides ?? [];
  const captions = scene.objects.find((o): o is CaptionObj => o.type === "caption" && o.source === "narration");
  clearPresentation(scene);
  if (captions) scene.objects.push(captions);
  specs.forEach((spec, i) => {
    const r = addSlide(scene, { ...spec, id: oldSlides[i]?.id }, themeId);
    (r.slide as { spec?: unknown }).spec = spec;
    // Keep recorded voices when the words didn't change.
    const was = old.find((a) => a.slide === oldSlides[i]?.id);
    const now = scene.objects.find((o): o is AudioObj => o.type === "audio" && o.role === "narration" && o.slide === r.slide.id);
    if (was && now && was.text === now.text && was.asset) {
      const shift = now.start - was.start;
      now.asset = was.asset;
      now.duration = was.duration;
      now.envelope = was.envelope;
      now.rate = was.rate;
      now.words = (was.words ?? []).map((w) => ({ ...w, start: w.start + shift, end: w.end + shift }));
    }
  });
  scene.theme = themeId;
  fitSlidesToNarration(scene);
  syncCaptions(scene);
}

type EditSet = Extract<ProOp, { op: "edit" }>["set"];

function editObject(scene: Scene, objId: string, s: EditSet): string {
  const o = need(scene, objId) as SceneObj & Record<string, unknown>;
  const fields = Object.keys(s);
  if (!fields.length) throw new Error("edit has nothing in set");
  const assign = (key: string, value: unknown) => {
    if (value === undefined) return;
    if (value === null) delete (o as Record<string, unknown>)[key];
    else (o as Record<string, unknown>)[key] = value;
  };
  for (const k of ["loop", "loopAmount", "locked", "hidden"] as const) assign(k, s[k]);
  if (s.pivot !== undefined) assign("pivot", s.pivot);
  if (o.type === "image" || o.type === "video") {
    if (s.adjust) o.adjust = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, ...(o.adjust ?? {}), ...s.adjust };
    if (s.look) {
      const look = COLOR_LOOKS.find((l) => l.id === s.look);
      if (!look) throw new Error(`no look "${s.look}"; looks: ${COLOR_LOOKS.map((l) => l.id).join(", ")}`);
      o.adjust = { ...look.adjust };
    }
    for (const k of ["shape", "border", "shadow", "crop", "flipX", "chroma", "w", "h"] as const) assign(k, s[k]);
  }
  if (o.type === "text") {
    for (const k of ["style", "accent", "subtext", "maxWidth", "italic", "letterSpacing", "lineHeight", "align", "text", "size", "font", "color"] as const) assign(k, s[k]);
  }
  if (o.type === "svg") {
    for (const k of ["colors", "speed", "clock", "flipX", "w", "h"] as const) assign(k, s[k]);
  }
  if (o.type === "video") {
    for (const k of ["volume", "fadeIn", "fadeOut", "reverse", "freeze", "speed"] as const) assign(k, s[k]);
  }
  if (o.type === "audio") {
    for (const k of ["volume", "fadeIn", "fadeOut", "speed", "role"] as const) assign(k, s[k]);
    if ((s.text !== undefined && s.text !== o.text) || (s.voice !== undefined && s.voice !== o.voice)) {
      if (s.text !== undefined) o.text = s.text;
      if (s.voice !== undefined) o.voice = s.voice;
      if (o.role === "narration") {
        o.asset = null;
        o.duration = speechSeconds(o.text ?? "");
        o.words = estimateWords(o.text ?? "", o.start, o.duration);
        delete o.envelope;
        syncCaptions(scene);
      }
    }
  }
  if (o.type === "caption") {
    if (s.captionStyle) o.style = s.captionStyle;
    for (const k of ["position", "maxChars", "font", "size", "color", "accent"] as const) assign(k, s[k]);
  }
  if (o.type === "region") {
    if (s.kind) {
      if (!(REGION_KINDS as readonly string[]).includes(s.kind)) throw new Error(`region kinds: ${REGION_KINDS.join(", ")}`);
      o.kind = s.kind as RegionObj["kind"];
    }
    for (const k of ["strength", "color", "w", "h"] as const) assign(k, s[k]);
    if (s.shape) o.shape = s.shape === "circle" ? "ellipse" : "rect";
  }
  if (o.type === "chart") {
    if (s.kind) {
      if (!(CHART_KINDS as readonly string[]).includes(s.kind)) throw new Error(`chart kinds: ${CHART_KINDS.join(", ")}`);
      o.kind = s.kind as ChartObj["kind"];
    }
    for (const k of ["data", "unit", "showValues", "textColor", "font", "w", "h"] as const) assign(k, s[k]);
  }
  return `changed ${fields.join(", ")} of ${objId}`;
}

/** The last moment any clip, slide, caption or chart needs the video to still be running. */
export function proEnd(scene: Scene): number {
  let end = 0;
  for (const o of scene.objects) {
    if (o.type === "video") end = Math.max(end, o.start + o.duration + (o.freeze ?? 0));
    if (o.type === "audio") end = Math.max(end, o.start + o.duration);
    if (o.type === "chart") end = Math.max(end, o.start + o.duration);
    if (o.type === "caption" && o.words.length) end = Math.max(end, o.words[o.words.length - 1].end + 0.4);
  }
  for (const s of scene.slides ?? []) end = Math.max(end, s.start + s.duration);
  return end;
}
