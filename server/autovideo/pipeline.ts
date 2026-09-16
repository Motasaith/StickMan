// Building an AI video: voice every scene, find and download footage, cut the timeline, and
// save it as a project the editor opens.

import { buildFootage, type SceneMedia, type VideoScript } from "../../src/engine/footage";
import { isLocalVoice, type VoiceRef } from "../../src/engine/scene";
import { nicheById } from "../../src/engine/niches";
import { createProject } from "../projects";
import { startJob, type Job } from "../jobs";
import { voiceLine, type Voiced } from "../voices/speak";
import { engineVoiceFor } from "../voices/local";
import { assetFromInfo, gatherFootage } from "./stock";
import { mediaInfo } from "../media";
import { stockConfigured } from "../stock";
import type { Asset } from "../../src/engine/scene";

export interface BuildRequest {
  script: VideoScript;
  voice: VoiceRef;
  captions: boolean;
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

export function startBuild(req: BuildRequest): Job<BuildResult> {
  const { script } = req;
  const niche = nicheById(script.niche);
  return startJob<BuildResult>(
    "autovideo",
    [
      { key: "voice", label: "Recording the narration" },
      { key: "footage", label: "Finding footage on Pexels" },
      { key: "download", label: "Downloading clips" },
      { key: "edit", label: "Editing the timeline" },
      { key: "save", label: "Saving the project" },
    ],
    async (ctl) => {
      // 1. Narration. Online voices run a few at a time; local voices one after another.
      const local = isLocalVoice(req.voice);
      const voiceLabel = local ? (await engineVoiceFor(req.voice)).label : req.voice;
      const voiced: Array<Voiced | null> = script.scenes.map(() => null);
      let done = 0;
      ctl.step("voice", { state: "running", done: 0, total: script.scenes.length });
      await pool(script.scenes, local ? 1 : 3, async (sc, i) => {
        ctl.check();
        try {
          voiced[i] = await voiceLine(sc.narration, req.voice, (p, stage) => ctl.step("voice", { detail: `Scene ${i + 1}: ${stage} (${Math.round(p * 100)}%)` }));
        } catch (err) {
          ctl.note(`Scene ${i + 1} wasn't voiced (${(err as Error).message}). Record it from the editor.`);
        }
        ctl.step("voice", { done: ++done, detail: `Scene ${done} of ${script.scenes.length}` });
      });
      if (voiced.every((v) => !v)) throw new Error("None of the narration could be recorded. Check the voice and try again.");
      ctl.step("voice", { state: "done", detail: undefined });

      // 2. Footage.
      const durations = script.scenes.map((sc, i) => (voiced[i]?.duration ?? sc.narration.split(/\s+/).length * 0.4) + 0.6);
      let footage: Awaited<ReturnType<typeof gatherFootage>> = { shots: script.scenes.map(() => []), assets: [], credits: [], misses: script.scenes.length };
      if (!stockConfigured()) {
        ctl.step("footage", { state: "skipped", detail: "Add PEXELS_API_KEY to .env for automatic footage" });
        ctl.step("download", { state: "skipped" });
        ctl.note("No footage was added: stock search isn't set up (PEXELS_API_KEY in .env). Scenes use a colored background.");
      } else {
        ctl.step("footage", { state: "running", total: script.scenes.length });
        footage = await gatherFootage(script.scenes, {
          format: script.format,
          durations,
          shotSeconds: niche.style.shotSeconds,
          fallback: niche.footage.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3),
          check: ctl.check,
          onProgress: (stage, d, total) => {
            if (stage === "search") {
              ctl.step("footage", { done: d, total, state: d === total ? "done" : "running" });
              if (d === total) ctl.step("download", { state: "running", done: 0, total: 0 });
            } else ctl.step("download", { done: d, total, state: d === total ? "done" : "running" });
          },
        });
        ctl.step("footage", { state: "done" });
        ctl.step("download", { state: "done", detail: `${footage.assets.length} clips and photos` });
        if (footage.misses) ctl.note(`${footage.misses} scene${footage.misses > 1 ? "s" : ""} found no footage and use a colored background; swap in your own from the Stock tab.`);
      }

      // 3. The edit.
      ctl.check();
      ctl.step("edit", { state: "running" });
      const media: SceneMedia[] = script.scenes.map((_, i) => ({
        narration: voiced[i] ? { asset: voiced[i]!.id, duration: voiced[i]!.duration, words: voiced[i]!.words } : null,
        shots: footage.shots[i] ?? [],
      }));
      const { scene, problems } = buildFootage(script, media, { voice: req.voice, style: niche.style, captions: req.captions });
      for (const p of problems.slice(0, 3)) ctl.note(`Edit: ${p}`);
      const voiceCredit = local ? `Voice: ${voiceLabel} (Kokoro, on this computer)` : "Voice: Microsoft Edge neural voice";
      scene.publish = {
        title: script.title,
        description: [script.description, footage.credits.length ? `\nFootage: ${footage.credits.slice(0, 20).join("; ")}.` : ""].join("").trim(),
        tags: script.tags,
        thumbnailText: script.thumbnailText,
        checks: script.checks,
        credits: [...footage.credits, voiceCredit],
        niche: niche.label,
      };
      ctl.step("edit", { state: "done", detail: `${scene.slides?.length ?? 0} scenes, ${Math.round(scene.duration)}s` });

      // 4. Save.
      ctl.step("save", { state: "running" });
      const assets: Asset[] = [...footage.assets];
      for (const v of voiced) {
        if (!v) continue;
        const info = await mediaInfo(v.id);
        if (info) assets.push({ ...assetFromInfo(info, `narration ${assets.length + 1}`), origin: "tts" });
      }
      const project = await createProject({ title: script.title.slice(0, 100), scene, assets, kind: "video" });
      ctl.step("save", { state: "done" });
      return { projectId: project.id, seconds: scene.duration, scenes: script.scenes.length, clips: footage.assets.length };
    }
  );
}
