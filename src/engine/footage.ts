// Faceless videos: a written script plus its recorded narration and stock clips become an
// edited timeline. Each script scene is a section (a slide) holding its narration, a series of
// B-roll shots cut to the voice, and any on-screen text; chapters change with a transition.

import type { AudioObj, ImageObj, Scene, Slide, TransitionKind, VideoObj, VoiceRef, Word } from "./scene";
import { emptyScene } from "./scene";
import { applyOps } from "./ops";
import { coverCrop, estimateWords } from "./media";
import { speechSeconds } from "./slides";
import type { NicheStyle } from "./niches";

export interface ScriptOverlay {
  kind: "title" | "stat" | "quote" | "lowerThird" | "list";
  text: string;
  sub?: string;
  value?: number;
  prefix?: string;
  suffix?: string;
  items?: string[];
}

export interface ScriptScene {
  id: string;
  /** Chapter name; a new chapter starts with a transition and a timeline marker. */
  chapter?: string;
  narration: string;
  /** Stock footage searches for this scene, most important first. */
  visuals: string[];
  media?: "video" | "photo";
  overlay?: ScriptOverlay | null;
}

export interface VideoScript {
  title: string;
  hook: string;
  description: string;
  tags: string[];
  thumbnailText: string;
  niche: string;
  format: "16:9" | "9:16";
  scenes: ScriptScene[];
  /** Claims to double-check before publishing. */
  checks: string[];
}

export interface ShotSource {
  asset: string;
  kind: "video" | "image";
  w: number;
  h: number;
  /** Seconds of video (0 for pictures). */
  duration: number;
  name?: string;
}

export interface SceneMedia {
  narration: { asset: string; duration: number; words: Word[] } | null;
  shots: ShotSource[];
}

export interface FootageOptions {
  voice: VoiceRef;
  style: NicheStyle;
  captions?: boolean;
  /** "Subscribe" card on the last scene. */
  endCard?: boolean;
}

/** Silence before and after each scene's narration. */
const LEAD = 0.25;
const TAIL = 0.35;

const round = (n: number) => Math.round(n * 1000) / 1000;

export const frameFor = (format: VideoScript["format"]) => (format === "9:16" ? { w: 720, h: 1280 } : { w: 1280, h: 720 });

function sceneDuration(scene: ScriptScene, media: SceneMedia | undefined): number {
  if (media?.narration) return round(LEAD + media.narration.duration + TAIL);
  return round(Math.max(3, LEAD + speechSeconds(scene.narration) + TAIL));
}

function transitionInto(script: VideoScript, i: number, style: NicheStyle): Slide["transition"] {
  if (i === 0) return { kind: "cut", duration: 0 };
  const cur = script.scenes[i];
  const prev = script.scenes[i - 1];
  const newChapter = !!cur.chapter && cur.chapter !== prev.chapter;
  const kind: TransitionKind = newChapter ? style.chapterTransition : style.sceneTransition;
  if (kind === "cut") return { kind, duration: 0 };
  return { kind, duration: newChapter ? 0.6 : 0.35 };
}

/** Build the whole edit. Pure: the same script and media always give the same timeline. */
export function buildFootage(script: VideoScript, media: SceneMedia[], opts: FootageOptions): { scene: Scene; problems: string[] } {
  const { w: W, h: H } = frameFor(script.format);
  const vertical = H > W;
  const style = opts.style;
  let scene = emptyScene(W, H);
  scene.background = "#000000";
  scene.title = script.title;
  scene.slides = [];
  scene.markers = [];

  const transitions = script.scenes.map((_, i) => transitionInto(script, i, style));
  const ops: unknown[] = [];
  /** Objects made by ops, and the scene section each belongs to. */
  const members = new Map<string, string>();
  /** Where each clip was last cut, so repeats show a different moment. */
  const cursor = new Map<string, number>();
  let t = 0;

  script.scenes.forEach((sc, i) => {
    const m = media[i];
    const id = `sc${i + 1}`;
    const dur = sceneDuration(sc, m);
    const start = round(t);
    const end = round(start + dur);
    const slide: Slide = {
      id,
      title: sc.chapter && (i === 0 || sc.chapter !== script.scenes[i - 1].chapter) ? sc.chapter : sc.narration.split(/[.!?]/)[0].slice(0, 40),
      start,
      duration: dur,
      background: m?.shots.length ? { kind: "color", color: "#000000" } : { kind: "gradient", from: "#0B0B12", to: style.accent, angle: 135 },
      transition: transitions[i],
      notes: sc.narration,
      layout: "footage",
    };
    scene.slides!.push(slide);
    if (sc.chapter && (i === 0 || sc.chapter !== script.scenes[i - 1].chapter)) scene.markers!.push({ t: start, label: sc.chapter.slice(0, 60), color: style.accent });

    // The last shot keeps playing under the next scene's transition.
    const overlap = transitions[i + 1]?.duration ?? 0;
    const shots = m?.shots ?? [];
    if (shots.length) {
      const count = Math.max(1, Math.round(dur / style.shotSeconds));
      const each = dur / count;
      for (let j = 0; j < count; j++) {
        const src = shots[j % shots.length];
        const s0 = round(start + j * each);
        const len = round(each + (j === count - 1 ? overlap : 0));
        const zoomIn = (i + j) % 2 === 0;
        const amount = src.kind === "image" ? style.zoom : style.zoom * 0.5;
        const scaleKeys = [
          { t: s0, v: zoomIn ? 1 : 1 + amount },
          { t: round(s0 + len), v: zoomIn ? 1 + amount : 1 },
        ];
        const common = {
          id: `${id}_shot${j + 1}`,
          name: src.name ?? `Shot ${j + 1}`,
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          opacity: 1,
          w: W,
          h: H,
          slide: id,
          pivot: "center" as const,
          crop: coverCrop(src.w, src.h, W, H),
        };
        if (src.kind === "video") {
          // Each use of a clip starts where the last one stopped; short clips play a little slower.
          const speed = Math.max(0.5, Math.min(1, (src.duration - 0.3) / len));
          const need = len * speed;
          let at = cursor.get(src.asset) ?? Math.min(0.5, Math.max(0, src.duration - need - 0.1));
          if (at + need > src.duration - 0.1) at = 0;
          cursor.set(src.asset, at + need);
          const shot: VideoObj = {
            ...common,
            type: "video",
            asset: src.asset,
            start: s0,
            duration: len,
            in: round(at),
            speed: round(speed),
            volume: 0,
            fadeIn: 0,
            fadeOut: 0,
            tracks: { scale: scaleKeys },
          };
          scene.objects.push(shot);
        } else {
          const pan = W * 0.02 * (zoomIn ? 1 : -1);
          const shot: ImageObj = {
            ...common,
            type: "image",
            asset: src.asset,
            tracks: {
              scale: scaleKeys,
              x: [
                { t: s0, v: 0 },
                { t: round(s0 + len), v: pan },
              ],
              opacity: [
                { t: 0, v: 0 },
                { t: s0, v: 1, e: "step" },
                { t: round(s0 + len), v: 0, e: "step" },
              ],
            },
          };
          scene.objects.push(shot);
        }
      }
    }

    // Narration: the recorded voice, or the script waiting to be voiced.
    const vStart = round(start + LEAD);
    const n = m?.narration;
    const voice: AudioObj = {
      id: `${id}_voice`,
      name: `Narration ${i + 1}`,
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
      opacity: 1,
      tracks: {},
      type: "audio",
      asset: n?.asset ?? null,
      role: "narration",
      start: vStart,
      duration: n ? round(n.duration) : round(dur - LEAD - TAIL),
      in: 0,
      speed: 1,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      text: sc.narration,
      voice: opts.voice,
      words: n ? n.words.map((w) => ({ text: w.text, start: round(vStart + w.start), end: round(vStart + w.end) })) : estimateWords(sc.narration, vStart, dur - LEAD - TAIL),
      slide: id,
    };
    scene.objects.push(voice);

    // On-screen text.
    const at = round(start + 0.3);
    const until = round(Math.max(at + 1.2, end - 0.25));
    const heading = { font: style.headingFont, accent: style.accent, color: "#FFFFFF" };
    const add = (op: Record<string, unknown>) => {
      ops.push(op);
      members.set(op.id as string, id);
    };
    const titleSize = Math.round(vertical ? W * 0.085 : H * 0.075);
    const o = sc.overlay;
    if (o?.kind === "title") {
      add({ op: "heading", id: `${id}_title`, text: o.text.slice(0, 80), x: W / 2, y: vertical ? H * 0.16 : H * 0.1, size: titleSize, style: style.headingStyle, align: "center", maxWidth: W * 0.84, at, until, enter: "slideUp", exit: "fade", ...heading });
    } else if (o?.kind === "lowerThird") {
      add({ op: "heading", id: `${id}_lower`, text: o.text.slice(0, 60), subtext: o.sub?.slice(0, 80), x: W * 0.06, y: vertical ? H * 0.58 : H * 0.6, size: Math.round(titleSize * 0.62), style: "lowerThird", align: "left", at, until, enter: "slideRight", exit: "fade", ...heading });
    } else if (o?.kind === "stat" && typeof o.value === "number") {
      ops.push({ op: "draw", id: `${id}_band`, name: "Band", x: 0, y: H * 0.3, parts: [{ kind: "rect", x: 0, y: 0, w: W, h: H * 0.34, fill: "#000000", opacity: 0.5 }] });
      members.set(`${id}_band`, id);
      add({ op: "counter", id: `${id}_stat`, to: o.value, from: 0, x: W / 2, y: H * 0.33, size: Math.round(vertical ? W * 0.2 : H * 0.17), color: style.accent, font: style.headingFont, prefix: o.prefix, suffix: o.suffix, decimals: Number.isInteger(o.value) ? 0 : 1, at, duration: 1.6 });
      add({ op: "heading", id: `${id}_statlabel`, text: o.text.slice(0, 80), x: W / 2, y: H * 0.33 + (vertical ? W * 0.24 : H * 0.2), size: Math.round(titleSize * 0.5), style: "plain", align: "center", maxWidth: W * 0.8, at: round(at + 0.4), until, enter: "fade", exit: "fade", ...heading });
    } else if (o?.kind === "quote") {
      ops.push({ op: "draw", id: `${id}_band`, name: "Band", x: 0, y: H * 0.28, parts: [{ kind: "rect", x: 0, y: 0, w: W, h: H * 0.38, fill: "#000000", opacity: 0.55 }] });
      members.set(`${id}_band`, id);
      add({ op: "heading", id: `${id}_quote`, text: `“${o.text.slice(0, 160)}”`, subtext: undefined, x: W / 2, y: H * 0.33, size: Math.round(titleSize * 0.62), style: "plain", align: "center", maxWidth: W * 0.8, at, until, enter: "fade", exit: "fade", ...heading, font: "dmserif" });
      if (o.sub) add({ op: "heading", id: `${id}_quoteby`, text: `- ${o.sub.slice(0, 60)}`, x: W / 2, y: H * 0.56, size: Math.round(titleSize * 0.4), style: "plain", align: "center", at: round(at + 0.6), until, enter: "fade", exit: "fade", ...heading });
    } else if (o?.kind === "list" && o.items?.length) {
      const items = o.items.slice(0, 4);
      const gap = (until - at) / (items.length + 0.5);
      items.forEach((item, k) => {
        add({ op: "heading", id: `${id}_item${k + 1}`, text: item.slice(0, 50), x: W * 0.07, y: (vertical ? H * 0.2 : H * 0.14) + k * titleSize * 1.35, size: Math.round(titleSize * 0.6), style: style.headingStyle, align: "left", at: round(at + k * gap), until, enter: "slideRight", exit: "fade", ...heading });
      });
    }

    // The video's name over the opening shot.
    if (i === 0 && !o && script.thumbnailText) {
      add({ op: "heading", id: `${id}_open`, text: script.thumbnailText.slice(0, 50), x: W / 2, y: vertical ? H * 0.38 : H * 0.36, size: Math.round(titleSize * 1.35), style: "outline", align: "center", maxWidth: W * 0.86, at: 0.2, until: round(Math.min(end - 0.2, 3.4)), enter: "pop", exit: "fade", ...heading });
    }
    if (i === script.scenes.length - 1 && opts.endCard !== false) {
      const cardAt = round(Math.max(start + 0.3, end - 3.2));
      add({ op: "heading", id: `${id}_subscribe`, text: vertical ? "Follow for more" : "Subscribe for more", x: W / 2, y: vertical ? H * 0.2 : H * 0.12, size: Math.round(titleSize * 0.7), style: "box", align: "center", at: cardAt, until: round(end + 0.5), enter: "pop", ...heading, color: "#FFFFFF" });
      const bell = Math.round(vertical ? W * 0.2 : H * 0.16);
      add({ op: "sticker", id: `${id}_bell`, emoji: "bell", x: W / 2 - bell / 2, y: (vertical ? H * 0.2 : H * 0.12) + titleSize * 1.3, size: bell, at: round(cardAt + 0.3), enter: "pop", loop: "swing" });
    }

    t = end;
  });

  scene.duration = Math.max(1, round(t));

  if (opts.captions !== false) {
    ops.push({
      op: "captions",
      from: "narration",
      style: style.caption,
      position: "bottom",
      font: "poppins",
      size: vertical ? 50 : 40,
      color: "#FFFFFF",
      accent: style.accent,
      maxChars: vertical ? 16 : 34,
    });
  }
  if (style.look && style.look !== "natural") ops.push({ op: "grade", look: style.look });

  const out = applyOps(scene, ops, []);
  scene = out.scene;
  for (const o of scene.objects) {
    const home = members.get(o.id);
    if (home) o.slide = home;
  }
  scene.duration = Math.max(1, round(t));
  return { scene, problems: out.results.filter((r) => !r.ok).map((r) => r.message) };
}

/** Seconds of narration a script will take, before it is recorded. */
export function scriptSeconds(script: Pick<VideoScript, "scenes">): number {
  return script.scenes.reduce((s, sc) => s + LEAD + speechSeconds(sc.narration) + TAIL, 0);
}
