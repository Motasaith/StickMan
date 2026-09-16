// Voice studio endpoints: the voice list, previews, blends, cloning and model installs.

import { Hono } from "hono";
import { z } from "zod";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { VOICE_IDS, isLocalVoice, type VoiceId } from "../../src/engine/scene";
import { VOICES } from "../../src/engine/voices";
import { CATALOG, PRESET_BLENDS } from "./catalog";
import { isInstalled as cloneInstalled } from "./clone";
import { addClone, clonePaths, deleteSavedVoice, listSavedVoices, saveBlend } from "./library";
import { enrolVoice, installModels } from "./engine";
import { REALTIME_FACTOR, speakLocal } from "./local";
import { DATA_DIR, MODELS_DIR } from "./paths";
import { runFfmpeg } from "../media";
import { speakWithWords } from "../tts";
import { getJob, startJob } from "../jobs";

export const voiceRoutes = new Hono();

const fail = (err: unknown) => ({ error: err instanceof Error ? err.message : String(err) });

const kokoroInstalled = () => existsSync(join(MODELS_DIR, "hf", "onnx-community", "Kokoro-82M-v1.0-ONNX", "onnx", "model_quantized.onnx"));

voiceRoutes.get("/api/voices", async (c) => {
  const saved = await listSavedVoices();
  return c.json({
    edge: VOICE_IDS.filter((id) => !["dog", "cat", "bird"].includes(id)).map((id) => ({ id, label: VOICES[id].label })),
    studio: CATALOG.map(({ id, name, language, gender, note, tier, tags, recommended, flag }) => ({ id: `kokoro:${id}`, name, language, gender, note, tier, tags, recommended, flag })),
    presets: PRESET_BLENDS.map((p) => ({ id: `preset:${p.id}`, name: p.name, desc: p.desc, components: p.components })),
    saved: saved.map(({ id, name, kind, blend, quality, note, created, source }) => ({ id: `custom:${id}`, rawId: id, name, kind, blend, quality, note, created, source })),
    installed: { studio: kokoroInstalled(), clone: await cloneInstalled("q8") },
    realtime: REALTIME_FACTOR,
  });
});

const PREVIEW_TEXT = "Here's the thing nobody tells you. The story you think you know is only half of it.";
const PREVIEW_DIR = join(DATA_DIR, "voices", "previews");

/** A short sample in the voice, cached on disk; studio voices take a few seconds to render. */
voiceRoutes.post("/api/voices/preview", async (c) => {
  const body = z
    .object({ voice: z.string().max(60), text: z.string().max(300).optional(), blend: z.array(z.object({ voice: z.string().max(20), weight: z.number().min(0).max(1) })).max(4).optional() })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Bad request" }, 400);
  const text = body.data.text?.trim() || PREVIEW_TEXT;
  const key = createHash("sha1").update(JSON.stringify([body.data.voice, text, body.data.blend ?? null])).digest("hex").slice(0, 16);
  await mkdir(PREVIEW_DIR, { recursive: true });
  try {
    if (!isLocalVoice(body.data.voice) && !body.data.blend) {
      if (!(VOICE_IDS as readonly string[]).includes(body.data.voice)) return c.json({ error: "Unknown voice" }, 400);
      const file = join(PREVIEW_DIR, `${key}.mp3`);
      if (!existsSync(file)) await writeFile(file, (await speakWithWords(text, body.data.voice as VoiceId)).mp3);
      return new Response(new Uint8Array(await readFile(file)), { headers: { "Content-Type": "audio/mpeg" } });
    }
    const file = join(PREVIEW_DIR, `${key}.wav`);
    if (!existsSync(file)) {
      // An unsaved blend is previewed by saving nothing: it is spoken straight from its mix.
      let audio: Buffer;
      if (body.data.blend) {
        const { synthesizeToWav } = await import("./engine");
        const tmp = join(PREVIEW_DIR, `${key}.part.wav`);
        await synthesizeToWav(text, { engine: "kokoro", spec: body.data.blend.filter((b) => b.weight > 0) }, tmp);
        audio = await readFile(tmp);
        await rm(tmp, { force: true });
      } else audio = (await speakLocal(text, body.data.voice)).audio;
      await writeFile(file, audio);
    }
    return new Response(new Uint8Array(await readFile(file)), { headers: { "Content-Type": "audio/wav" } });
  } catch (err) {
    return c.json(fail(err), 502);
  }
});

voiceRoutes.post("/api/voices/blend", async (c) => {
  const body = z
    .object({
      name: z.string().trim().min(1).max(40),
      components: z.array(z.object({ voice: z.string().max(20), weight: z.number().min(0).max(1) })).min(2).max(4),
      note: z.string().max(200).optional(),
    })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "A blend needs a name and two to four voices." }, 400);
  const known = new Set(CATALOG.map((v) => v.id));
  const components = body.data.components.filter((x) => x.weight > 0);
  if (components.length < 2 || components.some((x) => !known.has(x.voice))) return c.json({ error: "Pick at least two studio voices." }, 400);
  const v = await saveBlend(body.data.name, components, body.data.note);
  return c.json({ id: `custom:${v.id}`, name: v.name });
});

/** Clone a voice from a recording. The person must agree to it being cloned. */
voiceRoutes.post("/api/voices/clone", async (c) => {
  if (!(await cloneInstalled("q8"))) return c.json({ error: "The cloning model isn't installed yet. Install it first (about 1.1 GB)." }, 409);
  const form = await c.req.parseBody();
  const file = form.file;
  const name = typeof form.name === "string" ? form.name.trim().slice(0, 40) : "";
  if (!(file instanceof File)) return c.json({ error: "Add a recording of the voice." }, 400);
  if (!name) return c.json({ error: "Give the voice a name." }, 400);
  if (form.consent !== "true") return c.json({ error: "Confirm that you have the speaker's permission to clone this voice." }, 400);
  if (file.size > 60 * 1024 * 1024) return c.json({ error: "Use a shorter recording (10 to 30 seconds is best)." }, 413);
  const { id, profile } = clonePaths();
  const dir = join(DATA_DIR, "tmp");
  await mkdir(dir, { recursive: true });
  const src = join(dir, `${id}-in`);
  const wav = join(dir, `${id}.wav`);
  try {
    await writeFile(src, Buffer.from(await file.arrayBuffer()));
    // Mono 24 kHz, the first 40 seconds: all the model uses.
    await runFfmpeg(["-i", src, "-t", "40", "-vn", "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", wav], 120_000);
    await mkdir(join(profile, ".."), { recursive: true });
    const res = await enrolVoice(wav, profile);
    if (!res.ok) return c.json({ error: "That recording won't make a good clone.", report: res.report }, 422);
    const v = await addClone({ id, name, profile, sample: res.sample, quality: res.report.score, note: typeof form.note === "string" ? form.note.slice(0, 200) : undefined });
    return c.json({ id: `custom:${v.id}`, name: v.name, report: res.report });
  } catch (err) {
    return c.json(fail(err), 502);
  } finally {
    await rm(src, { force: true }).catch(() => {});
    await rm(wav, { force: true }).catch(() => {});
  }
});

voiceRoutes.delete("/api/voices/:id", async (c) => {
  try {
    await deleteSavedVoice(c.req.param("id").replace(/^custom:/, ""));
    return c.json({ ok: true });
  } catch (err) {
    return c.json(fail(err), 400);
  }
});

voiceRoutes.post("/api/voices/install", async (c) => {
  const body = z.object({ what: z.enum(["studio", "clone"]) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Bad request" }, 400);
  const what = body.data.what === "studio" ? "kokoro" : "clone";
  const job = startJob("install", [{ key: "download", label: what === "kokoro" ? "Studio voices (about 90 MB)" : "Voice cloning (about 1.1 GB)" }], async (ctl) => {
    ctl.step("download", { state: "running", total: 100 });
    await installModels(what, (p, stage) => ctl.step("download", { done: Math.round(p * 100), detail: stage }));
    ctl.step("download", { state: "done", done: 100 });
    return { installed: true };
  });
  return c.json({ job: job.id });
});

voiceRoutes.get("/api/jobs/:id", (c) => {
  const job = getJob(c.req.param("id"));
  return job ? c.json(job) : c.json({ error: "That job isn't running any more." }, 404);
});
