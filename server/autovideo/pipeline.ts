// Building an AI video: voice every scene (or cut the creator's own recording into scenes),
// find visuals, cut the timeline, add intro and outro, and save it as a project.

import { buildFootage, type SceneMedia, type ScriptScene, type VideoScript } from "../../src/engine/footage";
import { isLocalVoice, type Asset, type VoiceRef, type Word } from "../../src/engine/scene";
import { nicheById } from "../../src/engine/niches";
import { alignScenes } from "../../src/engine/align";
import { addIntro, addOutro } from "../../src/engine/intros";
import { syncCaptions } from "../../src/engine/slides";
import { createProject } from "../projects";
import { startJob, type Job } from "../jobs";
import { voiceLine, type Voiced } from "../voices/speak";
import { engineVoiceFor } from "../voices/local";
import { assetFromInfo, gatherFootage, type VisualMode } from "./stock";
import { mediaInfo } from "../media";

export interface BuildOptions {
  visuals: VisualMode;
  /** Straight cuts, no zooms, titles or end card. */
  simple: boolean;
  overlays: boolean;
  captions: boolean;
  intro: string | null;
  outro: string | null;
  channel?: string;
}

export interface BuildRequest {
  script: VideoScript;
  /** An AI voice; or the creator's own recording below. */
  voice?: VoiceRef;
  recording?: { asset: string; words: Word[] };
  options: BuildOptions;
}

export interface BuildResult {
  projectId: string;
  seconds: number;
  scenes: number;
  clips: number;
}

async function pool<T>(items: T[], size: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    })
  );
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function startBuild(req: BuildRequest): Job<BuildResult> {
  const niche = nicheById(req.script.niche);
  const o = req.options;
  const steps = [
    { key: "voice", label: req.recording ? "Matching your recording to the scenes" : "Recording the narration" },
    { key: "footage", label: o.visuals === "ai" ? "Planning AI pictures" : o.visuals === "none" ? "Leaving space for your visuals" : "Finding visuals" },
    { key: "download", label: o.visuals === "ai" ? "Drawing AI pictures" : "Downloading clips and photos" },
    { key: "edit", label: "Editing the timeline" },
    { key: "save", label: "Saving the project" },
  ];
  return startJob<BuildResult>("autovideo", steps, async (ctl) => {
    let script = req.script;
    const notes = (list: string[]) => list.forEach((n) => ctl.note(n));

    // 1. Narration.
    let media: Array<SceneMedia["narration"]>;
    const extraAssets: Asset[] = [];
    let voiceCredit = "";
    if (req.recording) {
      ctl.step("voice", { state: "running" });
      const info = await mediaInfo(req.recording.asset);
      if (!info) throw new Error("Your recording is no longer in the media library. Upload it again.");
      extraAssets.push({ ...assetFromInfo(info, "My narration"), origin: "recording" });
      const spans = alignScenes(
        script.scenes.map((s) => s.narration),
        req.recording.words
      );
      // Scenes the recording skips are dropped.
      const keep = spans.map((sp) => sp.end - sp.start > 0.2);
      const dropped = keep.filter((k) => !k).length;
      if (dropped) ctl.note(`${dropped} scene${dropped > 1 ? "s aren't" : " isn't"} in your recording, so ${dropped > 1 ? "they were" : "it was"} left out.`);
      const kept = spans.filter((_, i) => keep[i]);
      script = { ...script, scenes: script.scenes.filter((_, i) => keep[i]) };
      if (!script.scenes.length) throw new Error("None of the script was found in your recording. Check the language and that the script matches what you said.");
      media = kept.map((sp) => ({
        asset: req.recording!.asset,
        in: round(sp.start),
        duration: round(sp.end - sp.start),
        words: sp.words.map((w) => ({ text: w.text, start: round(Math.max(0, w.start - sp.start)), end: round(Math.max(0, w.end - sp.start)) })),
      }));
      ctl.step("voice", { state: "done", done: script.scenes.length, total: script.scenes.length, detail: `${script.scenes.length} scenes from your ${Math.round(info.duration ?? 0)}s recording` });
      voiceCredit = "Voice: the creator's own recording";
    } else {
      const voice = req.voice ?? niche.voices.edge;
      const local = isLocalVoice(voice);
      voiceCredit = local ? `Voice: ${(await engineVoiceFor(voice)).label} (made on this computer)` : "Voice: Microsoft Edge neural voice";
      const voiced: Array<Voiced | null> = script.scenes.map(() => null);
      let done = 0;
      ctl.step("voice", { state: "running", done: 0, total: script.scenes.length });
      // Online voices run a few at a time; local voices one after another.
      await pool(script.scenes, local ? 1 : 3, async (sc, i) => {
        ctl.check();
        try {
          voiced[i] = await voiceLine(sc.narration, voice, (p, stage) => ctl.step("voice", { detail: `Scene ${i + 1}: ${stage} (${Math.round(p * 100)}%)` }));
        } catch (err) {
          ctl.note(`Scene ${i + 1} wasn't voiced (${(err as Error).message}). Record it from the editor.`);
        }
        ctl.step("voice", { done: ++done, detail: `Scene ${done} of ${script.scenes.length}` });
      });
      if (voiced.every((v) => !v)) throw new Error("None of the narration could be recorded. Check the voice and try again.");
      ctl.step("voice", { state: "done", detail: undefined });
      media = voiced.map((v) => (v ? { asset: v.id, duration: v.duration, words: v.words } : null));
      for (const v of voiced) {
        if (!v) continue;
        const info = await mediaInfo(v.id);
        if (info) extraAssets.push({ ...assetFromInfo(info, "narration"), origin: "tts" });
      }
    }

    // 2. Visuals.
    const durations = script.scenes.map((sc, i) => (media[i]?.duration ?? sc.narration.split(/\s+/).length * 0.4) + 0.6);
    ctl.step("footage", { state: "running", total: script.scenes.length });
    const footage = await gatherFootage(script.scenes as ScriptScene[], {
      mode: o.visuals,
      format: script.format,
      durations,
      shotSeconds: niche.style.shotSeconds,
      fallback: niche.footage.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3),
      imageStyle: niche.imageStyle,
      space: niche.id === "science",
      check: ctl.check,
      onProgress: (stage, d, total) => {
        if (stage === "search") {
          ctl.step("footage", { done: d, total, state: d === total ? "done" : "running" });
          if (d === total) ctl.step("download", { state: "running", done: 0, total: 0 });
        } else ctl.step("download", { done: d, total, state: d === total ? "done" : "running" });
      },
    });
    ctl.step("footage", { state: o.visuals === "none" ? "skipped" : "done" });
    ctl.step("download", { state: o.visuals === "none" ? "skipped" : "done", detail: footage.assets.length ? `${footage.assets.length} clips and pictures` : undefined });
    notes(footage.notes);
    if (footage.misses && o.visuals !== "none") ctl.note(`${footage.misses} scene${footage.misses > 1 ? "s" : ""} found no visuals and use a colored background; add your own from the Stock or Media tab.`);

    // 3. The edit.
    ctl.check();
    ctl.step("edit", { state: "running" });
    const sceneMedia: SceneMedia[] = script.scenes.map((_, i) => ({ narration: media[i], shots: footage.shots[i] ?? [] }));
    const built = buildFootage(script, sceneMedia, {
      voice: req.recording ? undefined : (req.voice ?? niche.voices.edge),
      style: niche.style,
      captions: o.captions,
      overlays: o.overlays,
      simple: o.simple,
      endCard: !o.outro,
      openingTitle: !o.intro,
      padding: req.recording ? { lead: 0, tail: 0.15 } : undefined,
    });
    let scene = built.scene;
    const problems = [...built.problems];
    const card = { title: script.thumbnailText || script.title, subtitle: script.thumbnailText ? script.title : undefined, channel: o.channel, accent: niche.style.accent };
    if (o.intro) {
      const r = addIntro(scene, o.intro, card);
      scene = r.scene;
      problems.push(...r.problems);
    }
    if (o.outro) {
      const r = addOutro(scene, o.outro, { ...card, subtitle: undefined });
      scene = r.scene;
      problems.push(...r.problems);
    }
    syncCaptions(scene);
    for (const p of problems.slice(0, 3)) ctl.note(`Edit: ${p}`);
    scene.publish = {
      title: script.title,
      description: [script.description, footage.credits.length ? `\nVisuals: ${footage.credits.slice(0, 20).join("; ")}.` : ""].join("").trim(),
      tags: script.tags,
      thumbnailText: script.thumbnailText,
      checks: script.checks,
      credits: [...footage.credits, voiceCredit].filter(Boolean),
      niche: niche.label,
    };
    ctl.step("edit", { state: "done", detail: `${script.scenes.length} scenes, ${Math.round(scene.duration)}s` });

    // 4. Save.
    ctl.step("save", { state: "running" });
    const assets: Asset[] = [...footage.assets, ...extraAssets];
    const project = await createProject({ title: script.title.slice(0, 100), scene, assets, kind: "video" });
    ctl.step("save", { state: "done" });
    return { projectId: project.id, seconds: scene.duration, scenes: script.scenes.length, clips: footage.assets.length };
  });
}
