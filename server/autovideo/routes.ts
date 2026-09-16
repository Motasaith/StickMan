// AI video maker endpoints: ideas, scripts, scene rewrites and the background build.

import { Hono } from "hono";
import { z } from "zod";
import { NICHES } from "../../src/engine/niches";
import { LOCAL_VOICE_RE, VOICE_IDS, type VoiceRef } from "../../src/engine/scene";
import { llmConfig } from "../llm";
import { stockConfigured } from "../stock";
import { cancelJob } from "../jobs";
import { rewriteScene, suggestAngles, writeScript } from "./writer";
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
  c.json({ ai: !!llmConfig().baseUrl, stock: stockConfigured(), youtube: youtubeConfigured() })
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
      voice: z.union([z.enum(VOICE_IDS), z.string().regex(LOCAL_VOICE_RE)]),
      captions: z.boolean().default(true),
    })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "The script or voice isn't valid." }, 400);
  const job = startBuild({ script: body.data.script, voice: body.data.voice as VoiceRef, captions: body.data.captions });
  return c.json({ job: job.id });
});

autovideoRoutes.post("/api/jobs/:id/cancel", (c) => {
  const job = cancelJob(c.req.param("id"));
  return job ? c.json({ ok: true }) : c.json({ error: "No such job" }, 404);
});
