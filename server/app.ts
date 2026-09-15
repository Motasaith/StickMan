import { Hono } from "hono";
import { z } from "zod";
import type { Scene } from "../src/engine/scene";
import { applyOps, type OpResult } from "../src/engine/ops";
import { lintScene } from "../src/engine/lint";
import { CUTOUT_JOINTS, VOICE_IDS, type AssetInfo } from "./engineTypes";
import { speak } from "./tts";
import { finalizeVideo } from "./finalize";
import { chat, llmConfig, parseJsonObject, type ChatMessage } from "./llm";
import { describeScene, drawingDetails, systemPrompt } from "./prompt";
import { pro } from "./routes";
import { fillMissingArt, newArtCache } from "./artfill";

export const app = new Hono();
app.route("/", pro);

const point = z.object({ x: z.number(), y: z.number() });
const assetInfo = z.object({
  id: z.string(),
  name: z.string(),
  w: z.number(),
  h: z.number(),
  kind: z.enum(["image", "audio", "video", "svg"]).optional(),
  duration: z.number().optional(),
  hasAudio: z.boolean().optional(),
  joints: z.record(z.enum(CUTOUT_JOINTS), point).optional(),
});
const sceneShape = z
  .object({
    version: z.literal(1),
    width: z.number(),
    height: z.number(),
    duration: z.number(),
    objects: z.array(z.object({ id: z.string(), type: z.string() }).passthrough()),
  })
  .passthrough();

const planBody = z.object({
  prompt: z.string().min(1).max(4000),
  scene: sceneShape,
  assets: z.array(assetInfo).max(200).default([]),
  time: z.number().min(0).default(0),
  selectedId: z.string().nullable().default(null),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) }))
    .max(20)
    .default([]),
});

const reviewBody = z.object({
  prompt: z.string().min(1).max(4000),
  scene: sceneShape,
  assets: z.array(assetInfo).max(200).default([]),
  sheet: z.string().startsWith("data:image/").max(8_000_000),
  times: z.array(z.number()).max(24),
});

app.post("/api/tts", async (c) => {
  const parsed = z.object({ text: z.string().min(1).max(600), voice: z.enum(VOICE_IDS) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Bad request" }, 400);
  try {
    const mp3 = await speak(parsed.data.text, parsed.data.voice);
    return c.json({ audio: `data:audio/mpeg;base64,${mp3.toString("base64")}` });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 502);
  }
});

/** The vision model finds a character's joints on a picture, so it can become a puppet. */
app.post("/api/puppet/joints", async (c) => {
  const parsed = z
    .object({ image: z.string().startsWith("data:image/").max(6_000_000), w: z.number().positive(), h: z.number().positive() })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Bad request" }, 400);
  const { image, w, h } = parsed.data;
  try {
    const text = await chat(
      [
        {
          role: "user",
          content: [
            {
              type: "text",
              // Vision models locate far more accurately on a 0–1000 grid than in raw pixels.
              text: `This picture shows one character that will be animated as a cut-out puppet.
Locate these points on the character using normalized coordinates from 0 to 1000 (x: 0 = left edge, 1000 = right edge; y: 0 = top edge, 1000 = bottom edge):
- head: the center of the head
- neck: where the neck meets the shoulders
- hip: the middle point between the hips
- lElbow, lHand, lKnee, lFoot: the arm and leg on the LEFT side of the picture (as you look at it)
- rElbow, rHand, rKnee, rFoot: the arm and leg on the RIGHT side of the picture
Hands and feet mean their centers. If a limb is hidden, estimate where it would be.
Return ONLY JSON: {"head":{"x":0,"y":0},"neck":{...},"hip":{...},"lElbow":{...},"lHand":{...},"rElbow":{...},"rHand":{...},"lKnee":{...},"lFoot":{...},"rKnee":{...},"rFoot":{...}}`,
            },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
      { model: llmConfig().visionModel, jsonMode: true, temperature: 0.1, timeoutMs: 120_000 }
    );
    const obj = parseJsonObject(text) ?? {};
    const alias: Record<string, string[]> = { hip: ["hip", "hip_center", "hips", "pelvis"], head: ["head", "head_center"], neck: ["neck"] };
    const joints: Record<string, { x: number; y: number }> = {};
    for (const name of CUTOUT_JOINTS) {
      const key = (alias[name] ?? [name]).find((k) => obj[k]);
      const p = key ? (obj[key] as { x?: unknown; y?: unknown }) : undefined;
      if (!p || typeof p.x !== "number" || typeof p.y !== "number") return c.json({ error: `The AI didn't find "${name}"` }, 502);
      const frac = p.x <= 1.5 && p.y <= 1.5;
      const nx = frac ? p.x : p.x / 1000;
      const ny = frac ? p.y : p.y / 1000;
      joints[name] = { x: Math.max(0, Math.min(w, nx * w)), y: Math.max(0, Math.min(h, ny * h)) };
    }
    const problem = implausible(joints);
    if (problem) return c.json({ error: `the AI's guess didn't look like a body (${problem})` }, 502);
    return c.json({ joints });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 502);
  }
});

/** A quick sanity check that the points form an upright body. Returns what's wrong, or null. */
function implausible(j: Record<string, { x: number; y: number }>): string | null {
  if (!(j.head.y < j.neck.y && j.neck.y < j.hip.y)) return "head, neck and hips are out of order";
  for (const side of ["l", "r"]) {
    if (!(j.hip.y < j[`${side}Knee`].y && j[`${side}Knee`].y < j[`${side}Foot`].y)) return "legs are out of order";
    if (j[`${side}Hand`].y < j.head.y - (j.neck.y - j.head.y) * 3) return "a hand is far above the head";
  }
  if (j.lFoot.x > j.rFoot.x + 5 || j.lKnee.x > j.rKnee.x + 5) return "left and right legs are swapped";
  return null;
}

/** Re-encode an exported video's sound as AAC in an MP4, so every player has audio. */
app.post("/api/export/finalize", async (c) => {
  const ext = c.req.query("ext") === "webm" ? "webm" : "mp4";
  const body = Buffer.from(await c.req.arrayBuffer());
  if (body.length < 100 || body.length > 2_000_000_000) return c.json({ error: "Bad video" }, 400);
  try {
    const mp4 = await finalizeVideo(body, ext);
    return new Response(new Uint8Array(mp4), { headers: { "Content-Type": "video/mp4" } });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 502);
  }
});

app.get("/api/health", (c) => {
  const cfg = llmConfig();
  return c.json({ configured: !!cfg.baseUrl, model: cfg.model, visionModel: cfg.visionModel });
});

app.post("/api/ai/plan", async (c) => {
  const parsed = planBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Bad request" }, 400);
  const { prompt, assets, time, selectedId, history } = parsed.data;
  const scene = parsed.data.scene as unknown as Scene;
  try {
    const result = await planOps(scene, assets, prompt, { time, selectedId, history });
    return c.json(result);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 502);
  }
});

app.post("/api/ai/review", async (c) => {
  const parsed = reviewBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Bad request" }, 400);
  const { prompt, assets, sheet, times } = parsed.data;
  const scene = parsed.data.scene as unknown as Scene;
  try {
    const problems = await lookForProblems(scene, prompt, sheet, times);
    if (!problems.length) return c.json({ problems, ops: [], reply: "Checked the frames: it looks right." });
    const fix = await planOps(
      scene,
      assets,
      `The user asked: "${prompt}". After rendering, a reviewer looking at still frames reported these possible problems (the reviewer can be wrong, so check each against the scene data above first):\n${problems.map((p) => `- ${p}`).join("\n")}\nFix only problems that are real according to the scene data, with the smallest edits to EXISTING objects. Allowed ops: ${FIX_OPS.join(", ")}. Do not create, redraw or re-add anything, and do not repeat actions that already exist. If nothing is really wrong, return an empty ops list.`,
      { time: 0, selectedId: null, history: [] }
    );
    // A reviewer's guess must never wipe out or duplicate work: only adjustments to existing objects pass.
    const ops = (fix.ops as { op: string; id?: string }[]).filter(
      (op) =>
        FIX_OPS.includes(op.op) &&
        (op.op === "camera" || op.op === "grade" || scene.objects.some((o) => o.id === op.id) || (op.op === "updateSlide" && (scene.slides ?? []).some((sl) => sl.id === op.id)))
    );
    const reply = ops.length ? fix.reply : "";
    return c.json({ problems, ops, reply, skipped: fix.skipped });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 502);
  }
});

const FIX_OPS = ["move", "animate", "update", "pose", "joints", "face", "expression", "show", "hide", "camera", "order", "edit", "enter", "exit", "trim", "updateSlide", "grade"];

type Hist = { role: "user" | "assistant"; text: string };

async function planOps(
  scene: Scene,
  assets: AssetInfo[],
  prompt: string,
  ctx: { time: number; selectedId: string | null; history: Hist[] }
) {
  const details = drawingDetails(scene);
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(scene) },
    ...ctx.history.slice(-8).map((h) => ({ role: h.role, content: h.text }) as ChatMessage),
    {
      role: "user",
      content: `${describeScene(scene, assets, ctx)}${details ? `\nDRAWING PARTS (for editing):\n${details}` : ""}\n\nREQUEST: ${prompt}`,
    },
  ];

  // Problems that were there before this request aren't the AI's to fix now.
  const before = new Set(lintScene(scene));
  const art = newArtCache();
  const drawn = new Set<string>();
  let best: { reply: string; ops: unknown[]; results: OpResult[]; score: number; warnings: string[] } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await chat(messages, { jsonMode: true, reasoning: "medium", temperature: 0.5 });
    const obj = parseJsonObject(text);
    // Illustrations the library lacks are drawn now, so slides get a picture that really fits.
    const filled = await fillMissingArt(Array.isArray(obj?.ops) ? (obj!.ops as unknown[]) : [], art);
    filled.drawn.forEach((d) => drawn.add(d));
    const rawOps = filled.ops;
    const reply = typeof obj?.reply === "string" ? obj.reply : "";
    const dry = applyOps(scene, rawOps, assets);
    const failures = dry.results.filter((r) => !r.ok);
    const warnings = lintScene(dry.scene, dry.applied).filter((w) => !before.has(w));
    const score = dry.applied.length ? failures.length * 2 + warnings.length : Infinity;
    if (!best || score < best.score) best = { reply, ops: dry.applied, results: dry.results, score, warnings };
    if ((obj && !failures.length && !warnings.length) || attempt === 1) break;
    const feedback = obj
      ? [
          failures.length ? `These ops were rejected:\n${failures.map((f) => `- ${f.message}`).join("\n")}` : "",
          warnings.length ? `Checking the result found these problems:\n${warnings.map((w) => `- ${w}`).join("\n")}` : "",
          "Return the complete corrected JSON object again (all ops, not only the fixed ones). Keep \"reply\" describing the finished animation for the user, not the fixes.",
        ]
          .filter(Boolean)
          .join("\n")
      : `That was not a valid JSON object. Return ONLY {"reply": "...", "ops": [...]}.`;
    messages.push({ role: "assistant", content: text.slice(0, 20000) }, { role: "user", content: feedback });
  }
  const skipped = best!.results.filter((r) => !r.ok).map((r) => r.message);
  const ops = withCamerawork(scene, best!.ops, assets);
  return { reply: best!.reply, ops, skipped, warnings: best!.warnings, drawn: [...drawn] };
}

const CAMERA_OPS = new Set(["camera3d", "orbit", "shot", "direct"]);

/**
 * A 3D film needs camera work. When the AI builds or animates a 3D scene without
 * moving the camera, and nobody set up a camera before, the director plans the shots.
 */
function withCamerawork(scene: Scene, ops: unknown[], assets: AssetInfo[]): unknown[] {
  if (!ops.length) return ops;
  const camera = ops.filter((o) => CAMERA_OPS.has((o as { op?: string }).op ?? "")) as { op: string; at?: number; duration?: number }[];
  if (camera.some((o) => o.op === "direct")) return ops;
  const after = applyOps(scene, ops, assets).scene;
  if (after.mode !== "3d") return ops;
  if (camera.length) {
    // The AI planned some shots: the director covers whatever comes after the last one.
    const covered = Math.max(...camera.map((o) => (o.at ?? 0) + (o.duration ?? 0)));
    return covered < after.duration - 1.5 ? [...ops, { op: "direct", from: Math.round(covered * 10) / 10 }] : ops;
  }
  if (scene.camera3d && Object.keys(scene.camera3d.tracks).length) return ops;
  const moving = after.objects.some((o) => o.type !== "sound" && o.type !== "light" && Object.values(o.tracks).some((k) => (k?.length ?? 0) > 1));
  return moving || after.objects.length > 2 ? [...ops, { op: "direct" }] : ops;
}

function describeForReviewer(o: Scene["objects"][number]): string {
  switch (o.type) {
    case "stickman":
      return `${o.id} = stick man "${o.name}", line color ${o.color}`;
    case "text":
      return `${o.id} = text "${o.text.slice(0, 40)}"`;
    case "bubble":
      return `${o.id} = speech bubble "${o.text.slice(0, 40)}"`;
    case "drawing":
      return `${o.id} = drawing "${o.name}"`;
    case "image":
      return `${o.id} = picture`;
    case "creature":
      return `${o.id} = ${o.species} "${o.name}", color ${o.color}`;
    case "effect":
      return `${o.id} = ${o.kind} effect`;
    case "sound":
      return `${o.id} = ${o.kind} sound (not visible)`;
    case "light":
      return `${o.id} = a light (not visible itself)`;
    case "svg":
      return `${o.id} = ${o.src.startsWith("emoji:") ? "sticker" : "illustration"} "${o.name}"`;
    case "video":
      return `${o.id} = video clip "${o.name}" (${o.start}s to ${(o.start + o.duration).toFixed(1)}s)`;
    case "audio":
      return `${o.id} = ${o.role} audio (not visible)`;
    case "caption":
      return `${o.id} = captions`;
    case "region":
      return `${o.id} = ${o.kind} area`;
    case "chart":
      return `${o.id} = ${o.kind} chart of ${o.data.map((d) => d.label).join(", ")}`;
  }
}

async function lookForProblems(scene: Scene, prompt: string, sheet: string, times: number[]): Promise<string[]> {
  const cfg = llmConfig();
  const text = await chat(
    [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `This image is a contact sheet of ${times.length} frames from a video made in an animation and presentation editor, read left to right, top to bottom, at times ${times.map((t) => `${t.toFixed(1)}s`).join(", ")} (labelled in red; the red labels and grey borders are not part of the video).
The user asked for: "${prompt}"
Scene objects (these facts are certain): ${scene.objects.map(describeForReviewer).join("; ")}

Look for clear, concrete visual problems only, for example: something important is missing that the user asked for; objects overlap wrongly (a character inside a table or wall, text spilling outside its board); something is cut off at the canvas edge; a character is far away from the thing it is interacting with (writing on a board it is not next to); text is unreadable; a character floats above or sinks below the floor.
Text and speech bubbles type out letter by letter and drawings can appear part by part, so half-written text or a half-drawn prop in one frame is normal, not a problem. Presentation slides animate their text and illustrations in and cross-fade between slides, so a partly faded or sliding item is normal too. Captions at the bottom show the narration. A character writing on a board stands against it; that is not an overlap problem. Only report something as missing if it is missing in every frame where it should be. Do not comment on the simple drawing style, and do not invent problems. Describe each problem with the time and the object id.
Return ONLY JSON: {"problems": ["...", "..."]}, with an empty list if it looks right.`,
          },
          { type: "image_url", image_url: { url: sheet } },
        ],
      },
    ],
    { model: cfg.visionModel, jsonMode: true, temperature: 0.2, timeoutMs: 180_000 }
  );
  const obj = parseJsonObject(text);
  const problems = Array.isArray(obj?.problems) ? (obj!.problems as unknown[]).filter((p): p is string => typeof p === "string" && p.trim().length > 3) : [];
  return problems.slice(0, 8);
}
