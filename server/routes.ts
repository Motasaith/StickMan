// Editor endpoints: projects and versions, the media library, voices with word timings,
// stock media, speech-to-text, AI illustrations and extra export formats.

import { Hono } from "hono";
import { z } from "zod";
import { VOICE_IDS } from "../src/engine/scene";
import { addVersion, createProject, deleteProject, duplicateProject, getProject, getVersion, listProjects, listVersions, saveProject } from "./projects";
import { importMedia, mediaInfo, mediaPath, mediaUrl, probe, serveMedia, MAX_UPLOAD_BYTES } from "./media";
import { speakWithWords } from "./tts";
import { downloadStock, searchStock, stockConfigured } from "./stock";
import { SPEECH_LANGUAGES, transcribe } from "./stt";
import { drawIllustration } from "./illustrate";
import { EXPORT_FORMATS, convertExport } from "./convert";

export const pro = new Hono();

const fail = (err: unknown) => ({ error: err instanceof Error ? err.message : String(err) });

// ── Projects ────────────────────────────────────────────────────────

pro.get("/api/projects", async (c) => c.json({ projects: await listProjects() }));

pro.post("/api/projects", async (c) => {
  const body = z
    .object({ title: z.string().max(100).optional(), scene: z.record(z.string(), z.unknown()), assets: z.array(z.unknown()).optional(), kind: z.string().max(20).optional() })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Bad request" }, 400);
  const p = await createProject(body.data);
  return c.json({ id: p.id });
});

pro.get("/api/projects/:id", async (c) => {
  const p = await getProject(c.req.param("id"));
  return p ? c.json(p) : c.json({ error: "That project doesn't exist." }, 404);
});

pro.put("/api/projects/:id", async (c) => {
  const body = z
    .object({ title: z.string().max(100).optional(), scene: z.record(z.string(), z.unknown()).optional(), assets: z.array(z.unknown()).optional(), thumbnail: z.string().max(400_000).nullable().optional(), kind: z.string().max(20).optional() })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Bad request" }, 400);
  try {
    const p = await saveProject(c.req.param("id"), body.data);
    return c.json({ updatedAt: p.updatedAt });
  } catch (err) {
    return c.json(fail(err), 404);
  }
});

pro.delete("/api/projects/:id", async (c) => {
  try {
    await deleteProject(c.req.param("id"));
    return c.json({ ok: true });
  } catch (err) {
    return c.json(fail(err), 400);
  }
});

pro.post("/api/projects/:id/duplicate", async (c) => {
  try {
    const p = await duplicateProject(c.req.param("id"));
    return c.json({ id: p.id });
  } catch (err) {
    return c.json(fail(err), 404);
  }
});

pro.get("/api/projects/:id/versions", async (c) => c.json({ versions: await listVersions(c.req.param("id")) }));

pro.post("/api/projects/:id/versions", async (c) => {
  const body = z.object({ label: z.string().min(1).max(80) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Give the version a name" }, 400);
  try {
    return c.json(await addVersion(c.req.param("id"), body.data.label));
  } catch (err) {
    return c.json(fail(err), 404);
  }
});

pro.get("/api/projects/:id/versions/:vid", async (c) => {
  const v = await getVersion(c.req.param("id"), c.req.param("vid"));
  return v ? c.json(v) : c.json({ error: "That version doesn't exist." }, 404);
});

// ── Media library ───────────────────────────────────────────────────

pro.post("/api/media", async (c) => {
  const len = Number(c.req.header("content-length") ?? 0);
  if (len > MAX_UPLOAD_BYTES + 1024 * 1024) return c.json({ error: "That file is over 300 MB." }, 413);
  try {
    const form = await c.req.parseBody();
    const file = form.file;
    if (!(file instanceof File)) return c.json({ error: "No file" }, 400);
    const info = await importMedia(Buffer.from(await file.arrayBuffer()), file.name || "upload", { origin: typeof form.origin === "string" ? form.origin : "upload" });
    return c.json({ ...info, src: mediaUrl(info.file) });
  } catch (err) {
    return c.json(fail(err), 422);
  }
});

pro.get("/api/media/:file", async (c) => serveMedia(c.req.param("file"), c.req.header("range")));

pro.get("/api/media-info/:id", async (c) => {
  const info = await mediaInfo(c.req.param("id"));
  return info ? c.json({ ...info, src: mediaUrl(info.file) }) : c.json({ error: "Not found" }, 404);
});

// ── Voices with word timings ────────────────────────────────────────

pro.post("/api/voice", async (c) => {
  const parsed = z.object({ text: z.string().min(1).max(3000), voice: z.enum(VOICE_IDS) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Bad request" }, 400);
  try {
    const { mp3, words } = await speakWithWords(parsed.data.text, parsed.data.voice);
    const info = await importMedia(mp3, `voice-${parsed.data.voice}.mp3`, { origin: "tts" });
    const duration = info.duration ?? (await probe((await mediaPath(info.id))!)).duration;
    return c.json({ id: info.id, src: mediaUrl(info.file), duration, words, waveform: info.waveform ?? [] });
  } catch (err) {
    return c.json(fail(err), 502);
  }
});

// ── Stock media ─────────────────────────────────────────────────────

pro.get("/api/stock/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim().slice(0, 100);
  const kind = c.req.query("kind") === "video" ? "video" : "image";
  const o = c.req.query("orientation");
  const orientation = o === "portrait" || o === "square" ? o : "landscape";
  if (!q) return c.json({ items: [], configured: stockConfigured() });
  try {
    return c.json({ items: await searchStock(q, kind, orientation), configured: true });
  } catch (err) {
    return c.json({ ...fail(err), configured: stockConfigured() }, 502);
  }
});

pro.post("/api/stock/import", async (c) => {
  const body = z.object({ src: z.string().url(), name: z.string().max(120), credit: z.string().max(200) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Bad request" }, 400);
  try {
    const bytes = await downloadStock(body.data.src);
    const ext = new URL(body.data.src).pathname.match(/\.(mp4|jpe?g|png|webp)$/i)?.[0] ?? (body.data.src.includes("video") ? ".mp4" : ".jpg");
    const info = await importMedia(bytes, `${body.data.name}${ext}`, { origin: "stock", credit: body.data.credit });
    return c.json({ ...info, src: mediaUrl(info.file) });
  } catch (err) {
    return c.json(fail(err), 502);
  }
});

// ── Speech to text ──────────────────────────────────────────────────

pro.post("/api/transcribe", async (c) => {
  const body = z
    .object({ media: z.string().max(40), language: z.enum(SPEECH_LANGUAGES).default("english"), from: z.number().min(0).optional(), to: z.number().min(0).nullable().optional() })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Bad request" }, 400);
  const path = await mediaPath(body.data.media);
  if (!path) return c.json({ error: "That media isn't in the library." }, 404);
  try {
    const words = await transcribe(path, body.data.language, body.data.from ?? 0, body.data.to ?? null);
    return c.json({ words });
  } catch (err) {
    return c.json(fail(err), 502);
  }
});

// ── AI illustrations ────────────────────────────────────────────────

pro.post("/api/ai/illustrate", async (c) => {
  const body = z.object({ topic: z.string().min(2).max(200), hint: z.string().max(400).optional() }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Say what to draw" }, 400);
  try {
    return c.json(await drawIllustration(body.data.topic, body.data.hint));
  } catch (err) {
    return c.json(fail(err), 502);
  }
});

// ── Export formats ──────────────────────────────────────────────────

pro.post("/api/export/convert", async (c) => {
  const q = c.req.query();
  const opts = z
    .object({
      format: z.enum(EXPORT_FORMATS),
      start: z.coerce.number().min(0).optional(),
      end: z.coerce.number().min(0).optional(),
      fps: z.coerce.number().pipe(z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(60)])).optional(),
      size: z.enum(["small", "full"]).optional(),
      at: z.coerce.number().min(0).optional(),
    })
    .safeParse(q);
  if (!opts.success) return c.json({ error: "Bad export options" }, 400);
  const body = Buffer.from(await c.req.arrayBuffer());
  if (body.length < 100) return c.json({ error: "Bad video" }, 400);
  try {
    const out = await convertExport(body, opts.data);
    return new Response(new Uint8Array(out.bytes), { headers: { "Content-Type": out.mime, "X-File-Ext": out.ext } });
  } catch (err) {
    return c.json(fail(err), 422);
  }
});
