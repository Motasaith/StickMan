// Publishing helpers for finished videos: YouTube chapters, subtitle files, and a vertical
// Short cut from the opening of a long AI video.

import type { Asset, AudioObj, Scene, Word } from "./scene";
import { captionLines } from "./media";
import { buildFootage, type SceneMedia, type ShotSource, type VideoScript } from "./footage";
import { NICHES, CUSTOM_NICHE } from "./niches";
import { syncCaptions } from "./slides";

const stamp = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

/**
 * Chapter lines for a YouTube description. YouTube wants the first at 0:00, at least three,
 * and each at least 10 seconds long; returns "" when the video can't meet that.
 */
export function chaptersText(scene: Scene): string {
  const marks = [...(scene.markers ?? [])].sort((a, b) => a.t - b.t);
  const list: Array<{ t: number; label: string }> = [];
  const intro = scene.slides?.find((s) => s.id === "intro");
  const opening = !marks.length || marks[0].t >= 1;
  if (opening) list.push({ t: 0, label: intro ? "Intro" : scene.title || "Start" });
  for (const m of marks) {
    const t = list.length ? m.t : 0;
    const last = list[list.length - 1];
    if (last && t - last.t < 10) {
      // Too close to the previous chapter: a short intro takes the first chapter's name, otherwise the earlier one stays.
      if (list.length === 1 && (opening || last.label === "Intro")) last.label = m.label;
      continue;
    }
    list.push({ t, label: m.label });
  }
  const outro = scene.slides?.find((s) => s.id === "outro");
  if (outro && scene.duration - outro.start >= 5 && outro.start - list[list.length - 1].t >= 10) list.push({ t: outro.start, label: "Outro" });
  // The last chapter must also run 10 seconds.
  while (list.length > 1 && scene.duration - list[list.length - 1].t < 10) list.pop();
  if (list.length < 3) return "";
  return list.map((c) => `${stamp(c.t)} ${c.label}`).join("\n");
}

/** Every spoken word in the video, on the scene clock. */
export function spokenWords(scene: Scene): Word[] {
  const cap = scene.objects.find((o) => o.type === "caption");
  const words = cap?.type === "caption" && cap.words.length ? cap.words : scene.objects.flatMap((o) => (o.type === "audio" && o.role === "narration" ? (o.words ?? []) : []));
  return [...words].filter((w) => w.text.trim()).sort((a, b) => a.start - b.start);
}

const srtTime = (s: number, sep: "," | ".") => {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
  const m = String(Math.floor(ms / 60_000) % 60).padStart(2, "0");
  const sec = String(Math.floor(ms / 1000) % 60).padStart(2, "0");
  return `${h}:${m}:${sec}${sep}${String(ms % 1000).padStart(3, "0")}`;
};

/** SubRip or WebVTT subtitles from the narration, about two short lines per cue. */
export function subtitles(scene: Scene, format: "srt" | "vtt"): string {
  const lines = captionLines(spokenWords(scene), 42);
  const sep = format === "srt" ? "," : ".";
  const cues = lines.map((l, i) => {
    const next = lines[i + 1];
    const end = Math.min(l.end + 0.4, next ? next.start : l.end + 0.4);
    const text = l.words.map((w) => w.text.trim()).join(" ");
    const time = `${srtTime(l.start, sep)} --> ${srtTime(Math.max(end, l.start + 0.3), sep)}`;
    return format === "srt" ? `${i + 1}\n${time}\n${text}` : `${time}\n${text}`;
  });
  return (format === "vtt" ? "WEBVTT\n\n" : "") + cues.join("\n\n") + "\n";
}

export interface ShortResult {
  scene: Scene;
  /** How many of the long video's scenes it uses. */
  scenes: number;
  problems: string[];
}

/**
 * A vertical Short made from the opening scenes of a video built by the AI video maker: the same
 * narration and footage, re-cut for 9:16, up to `maxSeconds` long. Null for other projects.
 */
export function makeShort(scene: Scene, assets: Asset[], maxSeconds = 58): ShortResult | null {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const slides = (scene.slides ?? []).filter((s) => /^sc\d+$/.test(s.id)).sort((a, b) => a.start - b.start);
  if (!slides.length) return null;
  const script: VideoScript = {
    title: scene.publish?.title ?? scene.title ?? "Short",
    hook: "",
    description: scene.publish?.description ?? "",
    tags: scene.publish?.tags ?? [],
    thumbnailText: scene.publish?.thumbnailText ?? "",
    niche: "",
    format: "9:16",
    scenes: [],
    checks: scene.publish?.checks ?? [],
  };
  const media: SceneMedia[] = [];
  let total = 0;
  let voice: AudioObj["voice"];
  for (const slide of slides) {
    const v = scene.objects.find((o): o is AudioObj => o.id === `${slide.id}_voice` && o.type === "audio");
    const said = v?.text ?? slide.notes ?? "";
    const len = v ? v.duration + 0.5 : slide.duration;
    if (media.length && total + len > maxSeconds) break;
    total += len;
    voice ??= v?.voice;
    const shots: ShotSource[] = [];
    for (const o of scene.objects) {
      if (o.slide !== slide.id || (o.type !== "video" && o.type !== "image") || !o.id.startsWith(`${slide.id}_shot`) || !o.asset) continue;
      const a = byId.get(o.asset);
      if (!a || shots.some((s) => s.asset === a.id)) continue;
      shots.push({ asset: a.id, kind: o.type, w: a.w, h: a.h, duration: a.duration ?? 0, name: o.name });
    }
    const marker = scene.markers?.find((m) => Math.abs(m.t - slide.start) < 0.05);
    script.scenes.push({ id: slide.id, chapter: marker?.label, narration: said, visuals: [], media: shots[0]?.kind === "image" ? "photo" : "video", overlay: null });
    media.push({
      narration:
        v?.asset && v.words
          ? { asset: v.asset, duration: v.duration, in: v.in, words: v.words.map((w) => ({ text: w.text, start: w.start - v.start, end: w.end - v.start })) }
          : null,
      shots,
    });
  }
  // Only the first chapter name opens a Short; the rest would cut its flow.
  script.scenes.forEach((s, i) => i > 0 && (s.chapter = script.scenes[0].chapter));
  const niche = NICHES.find((n) => n.label === scene.publish?.niche) ?? CUSTOM_NICHE;
  const hasCaptions = scene.objects.some((o) => o.type === "caption");
  const built = buildFootage(script, media, { voice, style: niche.style, captions: hasCaptions, endCard: true, openingTitle: true });
  const out = built.scene;
  out.title = `${script.title} (Short)`.slice(0, 100);
  out.publish = scene.publish ? { ...scene.publish, title: `${script.title.slice(0, 90)} #shorts`, tags: [...scene.publish.tags, "shorts"].slice(0, 30) } : undefined;
  syncCaptions(out);
  return { scene: out, scenes: script.scenes.length, problems: built.problems };
}
