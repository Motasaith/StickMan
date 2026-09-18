// AI video maker endpoints: ideas, scripts, scene rewrites and the background build.

import { Hono } from "hono";
import { z } from "zod";
import { NICHES } from "../../src/engine/niches";
import { LOCAL_VOICE_RE, VOICE_IDS, type VoiceRef } from "../../src/engine/scene";
import { llmConfig } from "../llm";
import { stockConfigured } from "../stock";
import { cancelJob } from "../jobs";
import { rewriteScene, splitScript, suggestAngles, writeScript } from "./writer";
import { importMedia, mediaPath, mediaUrl, MAX_UPLOAD_BYTES } from "../media";
import { SPEECH_LANGUAGES, transcribe, type SpeechLanguage } from "../stt";
import { SOURCES, aiImagesKeyed, downloadMedia, generateImage, searchMedia } from "../sources";
import { INTROS, OUTROS } from "../../src/engine/intros";
import { checkCompetition, youtubeConfigured } from "./youtube";
import { startBuild } from "./pipeline";

export const autovideoRoutes = new Hono();

const fail = (err: unknown) => ({ error: err instanceof Error ? err.message : String(err) });

const brief = z.object({
  niche: z.string().refine((id) => id === "custom" || NICHES.some((n) => n.id === id), "unknown video type"),
  idea: z.string().max(2000).default(""),
  draft: z.string().max(20000).optional(),
  tone: z.string().max(60).optional(),
  minutes: z.number().min(0.5).max(20),
  format: z.enum(["16:9", "9:16"]),
  language: z.string().max(30).optional(),
  audience: z.string().max(120).optional(),
});

autovideoRoutes.get("/api/autovideo/status", (c) =>
  c.json({
    ai: !!llmConfig().baseUrl,
    stock: stockConfigured(),
    youtube: youtubeConfigured(),
    aiImages: aiImagesKeyed(),
    intros: INTROS.map(({ id, label, blurb, duration }) => ({ id, label, blurb, duration })),
    outros: OUTROS.map(({ id, label, blurb, duration }) => ({ id, label, blurb, duration })),
    sources: SOURCES,
  })
);

autovideoRoutes.post("/api/autovideo/angles", async (c) => {
  const body = brief.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Bad request" }, 400);
  try {
    const out = await suggestAngles(body.data);
    // Real competition numbers when a YouTube key is set; searches run side by side.
    const checked = await Promise.all(out.angles.map((a) => checkCompetition(a.searchPhrase || a.title).catch(() => null)));
    return c.json({ saturated: out.saturated, angles: out.angles.map((a, i) => ({ ...a, competition: checked[i] })), youtube: youtubeConfigured() });
  } catch (err) {
    return c.json(fail(err), 502);
  }
});

autovideoRoutes.post("/api/autovideo/script", async (c) => {
  const body = brief.extend({ angle: z.object({ title: z.string().max(160), hook: z.string().max(400).optional() }).optional() }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Bad request" }, 400);
  if (!body.data.idea.trim() && !body.data.draft?.trim() && !body.data.angle) return c.json({ error: "Say what the video is about, or paste your draft." }, 400);
  try {
    return c.json({ script: await writeScript(body.data) });
  } catch (err) {
    return c.json(fail(err), 502);
  }
});

/** The creator's finished script, kept word for word. */
autovideoRoutes.post("/api/autovideo/split", async (c) => {
  const body = brief.extend({ text: z.string().min(10).max(60000) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Paste the script first." }, 400);
  try {
    return c.json({ script: await splitScript(body.data) });
  } catch (err) {
    return c.json(fail(err), 502);
  }
});

const LANGUAGE_NAMES: Record<string, SpeechLanguage> = { english: "english", urdu: "urdu", hindi: "hindi", spanish: "spanish", french: "french", italian: "italian", portuguese: "portuguese" };

/** The creator's own narration: stored, then transcribed with word timings. */
autovideoRoutes.post("/api/autovideo/recording", async (c) => {
  const len = Number(c.req.header("content-length") ?? 0);
  if (len > MAX_UPLOAD_BYTES + 1024 * 1024) return c.json({ error: "That file is over 300 MB." }, 413);
  try {
    const form = await c.req.parseBody();
    const file = form.file;
    if (!(file instanceof File)) return c.json({ error: "Add your recording." }, 400);
    const language = LANGUAGE_NAMES[String(form.language ?? "english").toLowerCase()] ?? "english";
    if (!SPEECH_LANGUAGES.includes(language)) return c.json({ error: "That language can't be transcribed." }, 400);
    const info = await importMedia(Buffer.from(await file.arrayBuffer()), file.name || "narration.webm", { origin: "recording" });
    if (info.kind !== "audio" && info.kind !== "video") return c.json({ error: "That file has no sound." }, 422);
    const path = await mediaPath(info.id);
    const words = await transcribe(path!, language, 0, null);
    if (!words.length) return c.json({ error: "No speech was found in that recording." }, 422);
    return c.json({ media: { ...info, src: mediaUrl(info.file) }, words, text: words.map((w) => w.text).join(" ") });
  } catch (err) {
    return c.json(fail(err), 502);
  }
});

// ── Media search for the editor ─────────────────────────────────────

autovideoRoutes.get("/api/media-search", async (c) => {
  const source = SOURCES.find((x) => x.id === c.req.query("source"))?.id ?? "pexels";
  const q = (c.req.query("q") ?? "").trim().slice(0, 100);
  const kind = c.req.query("kind") === "video" ? "video" : "image";
  const o = c.req.query("orientation");
  const orientation = o === "portrait" || o === "square" ? o : "landscape";
  if (!q) return c.json({ items: [] });
  if (source === "pexels" && !stockConfigured()) return c.json({ items: [], error: "Add your Pexels API key in Settings." });
  try {
    return c.json({ items: await searchMedia(source, q, kind, orientation, 24) });
  } catch (err) {
    return c.json({ ...fail(err), items: [] }, 502);
  }
});

autovideoRoutes.post("/api/media-search/import", async (c) => {
  const body = z.object({ src: z.string().url(), name: z.string().max(120), credit: z.string().max(300), kind: z.enum(["image", "video", "audio"]), origin: z.string().max(20).optional() }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Bad request" }, 400);
  try {
    const bytes = await downloadMedia(body.data.src);
    const ext = body.data.kind === "video" ? ".mp4" : body.data.kind === "audio" ? ".mp3" : /\.png(\?|$)/i.test(body.data.src) ? ".png" : ".jpg";
    const info = await importMedia(bytes, `${body.data.name}${ext}`, { origin: body.data.origin ?? "stock", credit: body.data.credit });
    return c.json({ ...info, src: mediaUrl(info.file) });
  } catch (err) {
    return c.json(fail(err), 502);
  }
});

/** An AI picture, stored in the media library. */
autovideoRoutes.post("/api/ai/image", async (c) => {
  const body = z.object({ prompt: z.string().min(3).max(800), w: z.number().int().min(256).max(2048), h: z.number().int().min(256).max(2048), seed: z.number().int().min(0).max(1e9).optional() }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Describe the picture." }, 400);
  try {
    const img = await generateImage(body.data.prompt, body.data.w, body.data.h, body.data.seed ?? Math.floor(Math.random() * 1e6));
    const info = await importMedia(img.bytes, `AI ${body.data.prompt.slice(0, 30).replace(/[^\w\- ]+/g, "")}.jpg`, { origin: "ai", credit: img.credit });
    return c.json({ ...info, src: mediaUrl(info.file), watermark: img.watermark });
  } catch (err) {
    return c.json(fail(err), 502);
  }
});

const overlay = z
  .object({
    kind: z.enum(["title", "stat", "quote", "lowerThird", "list"]),
    text: z.string().max(200),
    sub: z.string().max(120).optional(),
    value: z.number().finite().optional(),
    prefix: z.string().max(4).optional(),
    suffix: z.string().max(10).optional(),
    items: z.array(z.string().max(60)).max(4).optional(),
  })
  .nullable()
  .optional();

const scriptBody = z.object({
  title: z.string().min(1).max(160),
  hook: z.string().max(400).default(""),
  description: z.string().max(5000).default(""),
  tags: z.array(z.string().max(60)).max(30).default([]),
  thumbnailText: z.string().max(80).default(""),
  niche: z.string().max(30),
  format: z.enum(["16:9", "9:16"]),
  checks: z.array(z.string().max(400)).max(40).default([]),
  scenes: z
    .array(
      z.object({
        id: z.string().max(20),
        chapter: z.string().max(80).optional(),
        narration: z.string().min(1).max(3000),
        visuals: z.array(z.string().max(100)).max(6),
        media: z.enum(["video", "photo"]).optional(),
        overlay,
      })
    )
    .min(1)
    .max(150),
});

autovideoRoutes.post("/api/autovideo/rewrite", async (c) => {
  const body = z
    .object({ script: scriptBody, index: z.number().int().min(0), instruction: z.string().max(400).default(""), tone: z.string().max(60).optional() })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Bad request" }, 400);
  try {
    return c.json({ scene: await rewriteScene(body.data) });
  } catch (err) {
    return c.json(fail(err), 502);
  }
});

autovideoRoutes.post("/api/autovideo/build", async (c) => {
  const body = z
    .object({
      script: scriptBody,
      voice: z.union([z.enum(VOICE_IDS), z.string().regex(LOCAL_VOICE_RE)]).optional(),
      recording: z
        .object({
          asset: z.string().max(40),
          words: z.array(z.object({ text: z.string().max(80), start: z.number().min(0), end: z.number().min(0) })).max(20000),
        })
        .optional(),
      options: z
        .object({
          visuals: z.enum(["stock", "ai", "mix", "real", "none"]).default("stock"),
          simple: z.boolean().default(false),
          overlays: z.boolean().default(true),
          captions: z.boolean().default(true),
          intro: z.string().max(30).nullable().default(null),
          outro: z.string().max(30).nullable().default(null),
          channel: z.string().max(60).optional(),
        })
        .prefault({}),
    })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "The script or voice isn't valid." }, 400);
  if (!body.data.voice && !body.data.recording) return c.json({ error: "Pick a voice or add your recording." }, 400);
  const job = startBuild({ script: body.data.script, voice: body.data.voice as VoiceRef | undefined, recording: body.data.recording, options: body.data.options });
  return c.json({ job: job.id });
});

autovideoRoutes.post("/api/jobs/:id/cancel", (c) => {
  const job = cancelJob(c.req.param("id"));
  return job ? c.json({ ok: true }) : c.json({ error: "No such job" }, 404);
});
