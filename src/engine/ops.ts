// Everything the AI (and the editor's buttons) can do to the canvas.
// Each op is validated on its own, so one bad op never breaks the rest.

import { z } from "zod";
import type { Asset, CreatureObj, Ease, EffectObj, Key, LightObj, Part, Scene, SceneObj, SoundObj, StickmanObj, Tracks } from "./scene";
import { LIGHTING_PRESETS, SOUND_KINDS } from "./scene";
import { PROP_KINDS, PROP_LIGHTS, buildProp } from "./props";
import { SHOT_KINDS, directScene, planShot } from "./director";
import { applyProOp, proEnd, proOpSchemas, type ProContext, type ProOp } from "./proOps";
import { DEFAULT_LOOK, EFFECT_KINDS, EXPRESSIONS, FONTS, HAIRS, HATS, LOOK_STYLES, VOICE_IDS, cloneScene, findObj, uniqueId } from "./scene";
import { STICKMAN_ANCHORS, activeLink, anchorAt, objectBounds, stickmanPoints, stickmanTransform, worldState } from "./render";
import { FULL_BODY_POSES, LEG, POSES, POSE_NAMES, STAND, type PoseName } from "./rig";
import { ACTIONS, playAction, setExpression, setFacing, transitionToPose, walkTo, type ActionName } from "./motion";
import { animateTrack, baseValue, camera3dBase, cameraBase, ease as easeFn, lastKeyTime, removeKeys, upsertKey, valueAt } from "./tracks";
import {
  CREATURE_ACTIONS,
  CREATURE_POSES,
  SPECIES_DEFAULTS,
  birdFlyTo,
  creatureActionsFor,
  rigOf,
  creatureMove,
  creaturePose,
  playCreatureAction,
  type CreatureAction,
  type CreaturePose,
} from "./creatures";

export type AssetInfo = Pick<Asset, "id" | "name" | "w" | "h" | "joints" | "kind" | "duration" | "hasAudio">;

const num = z.number().finite();
const time = z.number().finite().min(0).max(3600);
const color = z.string().max(40);
const id = z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, "ids use letters, digits, _ and -");
const easeSchema = z.enum(["linear", "easeIn", "easeOut", "easeInOut", "step"]);

const style = {
  glow: z.boolean().optional(),
  rotX: num.optional(),
  rotY: num.optional(),
  rotZ: num.optional(),
  fill: color.optional(),
  stroke: color.optional(),
  width: z.number().min(0).max(200).optional(),
  dash: z.array(z.number().min(0).max(200)).max(8).optional(),
  opacity: z.number().min(0).max(1).optional(),
};

export const partSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rect"), x: num, y: num, w: num, h: num, r: num.optional(), ...style }),
  z.object({ kind: z.literal("circle"), cx: num, cy: num, r: num, ...style }),
  z.object({ kind: z.literal("ellipse"), cx: num, cy: num, rx: num, ry: num, ...style }),
  z.object({ kind: z.literal("line"), x1: num, y1: num, x2: num, y2: num, ...style }),
  z.object({ kind: z.literal("poly"), points: z.array(num).min(4).max(2000), closed: z.boolean().optional(), ...style }),
  z.object({ kind: z.literal("path"), d: z.string().min(1).max(20000), ...style }),
  z.object({ kind: z.literal("box3"), x: num, y: num, z: num.optional(), w: z.number().min(0).max(5000), h: z.number().min(0).max(5000), d: z.number().min(0).max(5000), ...style }),
  z.object({ kind: z.literal("prism3"), x: num, y: num, z: num.optional(), w: z.number().min(0).max(5000), h: z.number().min(0).max(5000), d: z.number().min(0).max(5000), ...style }),
  z.object({ kind: z.literal("sphere3"), cx: num, cy: num, cz: num.optional(), r: z.number().min(0).max(3000), ...style }),
  z.object({ kind: z.literal("cylinder3"), cx: num, y: num, z: num.optional(), r: z.number().min(0).max(3000), h: z.number().min(0).max(5000), ...style }),
  z.object({ kind: z.literal("cone3"), cx: num, y: num, z: num.optional(), r: z.number().min(0).max(3000), h: z.number().min(0).max(5000), ...style }),
  z.object({
    kind: z.literal("text"),
    x: num,
    y: num,
    text: z.string().max(2000),
    size: z.number().min(4).max(400).optional(),
    font: z.enum(FONTS).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    bold: z.boolean().optional(),
    ...style,
  }),
]);

const ALL_POSES = [...new Set([...POSE_NAMES, ...CREATURE_POSES])] as [string, ...string[]];
const ALL_ACTIONS = [...new Set([...ACTIONS, ...CREATURE_ACTIONS])] as [string, ...string[]];
const poseName = z.enum(ALL_POSES);
const voiceId = z.enum(VOICE_IDS);
const lookSchema = z
  .object({
    style: z.enum(LOOK_STYLES),
    skin: color,
    shirt: color,
    pants: color,
    shoes: color,
    hair: z.enum(HAIRS),
    hairColor: color,
    hat: z.enum(HATS),
    hatColor: color,
    glasses: z.boolean(),
    beard: z.boolean(),
    dress: z.boolean(),
  })
  .partial();
const boneSchema = z.object({
  name: id,
  parent: id.nullable().optional(),
  x: num.default(0),
  y: num.default(0),
  length: z.number().min(0).max(2000).default(20),
  angle: num.default(0),
  z: num.optional(),
  parts: z.array(partSchema).max(60).default([]),
});
const propAmounts = z.record(z.string().max(40), num);
const jointValues = z
  .object({
    torso: num,
    neck: num,
    lShoulder: num,
    lElbow: num,
    rShoulder: num,
    rElbow: num,
    lHip: num,
    lKnee: num,
    rHip: num,
    rKnee: num,
    hipY: num,
  })
  .partial();

export const opSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("scene"),
    mode: z.enum(["2d", "3d"]).optional(),
    lighting: z.enum(LIGHTING_PRESETS).optional(),
    look3d: z.enum(["soft", "toon"]).optional(),
    floor: color.optional(),
    background: color.optional(),
    backgroundImage: z.string().nullable().optional(),
    duration: z.number().min(0.5).max(3600).optional(),
    width: z.number().int().min(64).max(3840).optional(),
    height: z.number().int().min(64).max(3840).optional(),
    fps: z.number().int().min(1).max(60).optional(),
  }),
  z.object({
    op: z.literal("draw"),
    id,
    name: z.string().max(60).optional(),
    x: num.default(0),
    y: num.default(0),
    parts: z.array(partSchema).min(1).max(400),
    at: time.optional(),
    drawOn: z.number().min(0).max(60).optional(),
  }),
  z.object({
    op: z.literal("text"),
    id,
    text: z.string().max(4000),
    x: num,
    y: num,
    size: z.number().min(4).max(400).optional(),
    color: color.optional(),
    font: z.enum(FONTS).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    bold: z.boolean().optional(),
    at: time.optional(),
    typeOn: z.number().min(0).max(60).optional(),
  }),
  z.object({
    op: z.literal("character"),
    id,
    name: z.string().max(60).optional(),
    x: num,
    y: num.optional(),
    color: color.optional(),
    lineWidth: z.number().min(1).max(40).optional(),
    scale: z.number().min(0.1).max(10).optional(),
    facing: z.enum(["left", "right"]).optional(),
    pose: poseName.optional(),
    expression: z.enum(EXPRESSIONS).optional(),
    look: lookSchema.optional(),
    voice: voiceId.optional(),
    at: time.optional(),
  }),
  z.object({
    op: z.literal("creature"),
    id,
    species: z.enum(["dog", "cat", "bird", "fish"]),
    name: z.string().max(60).optional(),
    x: num,
    y: num.optional(),
    color: color.optional(),
    accent: color.optional(),
    scale: z.number().min(0.1).max(10).optional(),
    facing: z.enum(["left", "right"]).optional(),
    pose: z.enum(CREATURE_POSES).optional(),
    voice: voiceId.optional(),
    at: time.optional(),
  }),
  z.object({
    op: z.literal("rig"),
    id,
    name: z.string().max(60).optional(),
    x: num,
    y: num.optional(),
    scale: z.number().min(0.1).max(10).optional(),
    facing: z.enum(["left", "right"]).optional(),
    bones: z.array(boneSchema).min(1).max(40),
    voice: voiceId.optional(),
    at: time.optional(),
  }),
  z.object({
    op: z.literal("puppet"),
    id,
    asset: z.string().min(1),
    name: z.string().max(60).optional(),
    x: num,
    y: num.optional(),
    scale: z.number().min(0.1).max(10).optional(),
    facing: z.enum(["left", "right"]).optional(),
    voice: voiceId.optional(),
    at: time.optional(),
  }),
  z.object({ op: z.literal("look"), id, set: lookSchema, voice: voiceId.optional() }),
  z.object({ op: z.literal("bones"), id, bones: propAmounts, at: time, duration: z.number().min(0).max(30).optional(), ease: easeSchema.optional() }),
  z.object({
    op: z.literal("cycle"),
    id,
    bones: propAmounts,
    period: z.number().min(0.08).max(10),
    at: time,
    duration: z.number().min(0.1).max(120),
    phaseStep: z.number().min(0).max(1).optional(),
  }),
  z.object({
    op: z.literal("hold"),
    id,
    item: id,
    hand: z.enum(["right", "left"]).optional(),
    at: time,
    follow: z.enum(["position", "full"]).optional(),
  }),
  z.object({ op: z.literal("drop"), id, at: time, fall: z.boolean().optional() }),
  z.object({
    op: z.literal("attach"),
    id,
    to: id,
    anchor: z.string().max(40).optional(),
    at: time,
    follow: z.enum(["position", "full"]).optional(),
  }),
  z.object({ op: z.literal("detach"), id, at: time }),
  z.object({
    op: z.literal("effect"),
    id,
    kind: z.enum(EFFECT_KINDS),
    name: z.string().max(60).optional(),
    x: num.optional(),
    y: num.optional(),
    w: z.number().positive().max(10000).optional(),
    h: z.number().positive().max(10000).optional(),
    density: z.number().min(0.05).max(5).optional(),
    color: color.nullable().optional(),
    at: time.optional(),
    until: time.optional(),
  }),
  z.object({
    op: z.literal("bounce"),
    id,
    at: time,
    height: z.number().min(5).max(2000).optional(),
    times: z.number().int().min(1).max(12).optional(),
    squash: z.boolean().optional(),
  }),
  z.object({
    op: z.literal("path"),
    id,
    points: z.array(num).min(4).max(400),
    at: time,
    duration: z.number().min(0.1).max(120),
    ease: easeSchema.optional(),
    orient: z.boolean().optional(),
  }),
  z.object({ op: z.literal("shake"), id: id.optional(), at: time, duration: z.number().min(0.05).max(10).optional(), strength: z.number().min(1).max(200).optional() }),
  z.object({ op: z.literal("fly"), id, x: num, y: num, at: time, duration: z.number().min(0.2).max(60).optional() }),
  z.object({
    op: z.literal("image"),
    id,
    asset: z.string().min(1),
    x: num,
    y: num,
    w: z.number().positive().max(10000).optional(),
    h: z.number().positive().max(10000).optional(),
    at: time.optional(),
  }),
  z.object({
    op: z.literal("say"),
    id: id.optional(),
    character: id.nullable().optional(),
    text: z.string().min(1).max(500),
    at: time,
    duration: z.number().min(0.2).max(60).optional(),
    thought: z.boolean().optional(),
    voice: z.enum([...VOICE_IDS, "none"]).optional(),
    x: num.optional(),
    y: num.optional(),
  }),
  z.object({ op: z.literal("move"), id, x: num.optional(), y: num.optional(), z: num.optional(), at: time, duration: z.number().min(0).max(120).optional(), ease: easeSchema.optional() }),
  z.object({ op: z.literal("turn"), id, yaw: num, at: time, duration: z.number().min(0).max(30).optional() }),
  z.object({
    op: z.literal("camera3d"),
    yaw: num.optional(),
    pitch: z.number().min(-89).max(89).optional(),
    distance: z.number().min(50).max(20000).optional(),
    x: num.optional(),
    y: num.optional(),
    z: num.optional(),
    fov: z.number().min(10).max(100).optional(),
    at: time,
    duration: z.number().min(0).max(120).optional(),
    ease: easeSchema.optional(),
  }),
  z.object({ op: z.literal("orbit"), degrees: num, at: time, duration: z.number().min(0.1).max(120) }),
  z.object({ op: z.literal("shot"), kind: z.enum(SHOT_KINDS), target: id.optional(), target2: id.optional(), at: time, duration: z.number().min(0.3).max(120) }),
  z.object({ op: z.literal("direct"), from: z.number().min(0).max(3600).optional() }),
  z.object({
    op: z.literal("prop"),
    id,
    kind: z.enum(PROP_KINDS),
    name: z.string().max(60).optional(),
    x: num,
    y: num.optional(),
    z: num.optional(),
    yaw: num.optional(),
    scale: z.number().min(0.1).max(20).optional(),
    color: color.optional(),
    color2: color.optional(),
    w: z.number().min(10).max(5000).optional(),
    h: z.number().min(10).max(5000).optional(),
    text: z.string().max(60).optional(),
    lit: z.boolean().optional(),
    at: time.optional(),
  }),
  z.object({
    op: z.literal("light"),
    id,
    kind: z.enum(["point", "spot"]).optional(),
    x: num,
    y: num,
    z: num.optional(),
    color: color.optional(),
    intensity: z.number().min(0).max(20).optional(),
    distance: z.number().min(10).max(20000).optional(),
    at: time.optional(),
  }),
  z.object({ op: z.literal("sound"), id: id.optional(), kind: z.enum(SOUND_KINDS), at: time, duration: z.number().min(0.1).max(120).optional(), volume: z.number().min(0).max(2).optional() }),
  z.object({
    op: z.literal("walk"),
    id,
    x: num.optional(),
    z: num.optional(),
    to: id.optional(),
    side: z.enum(["left", "right", "auto"]).optional(),
    at: time,
    duration: z.number().min(0.1).max(120).optional(),
    style: z.enum(["walk", "run", "sneak", "fly"]).optional(),
  }),
  z.object({
    op: z.literal("write"),
    id,
    on: id,
    text: z.string().min(1).max(300),
    at: time,
    textId: id.optional(),
    color: color.optional(),
    size: z.number().min(8).max(200).optional(),
  }),
  z.object({ op: z.literal("pose"), id, pose: poseName, on: id.optional(), at: time, duration: z.number().min(0).max(30).optional() }),
  z.object({ op: z.literal("joints"), id, joints: jointValues, at: time, duration: z.number().min(0).max(30).optional(), ease: easeSchema.optional() }),
  z.object({ op: z.literal("action"), id, action: z.enum(ALL_ACTIONS), at: time, times: z.number().int().min(1).max(20).optional(), duration: z.number().min(0.1).max(60).optional() }),
  z.object({ op: z.literal("face"), id, direction: z.enum(["left", "right"]).optional(), toward: id.optional(), at: time }),
  z.object({ op: z.literal("expression"), id, expression: z.enum(EXPRESSIONS), at: time }),
  z.object({
    op: z.literal("animate"),
    id,
    prop: z.enum(["x", "y", "z", "yaw", "rotation", "scale", "opacity", "reveal"]),
    to: num,
    at: time,
    duration: z.number().min(0).max(120).optional(),
    ease: easeSchema.optional(),
  }),
  z.object({ op: z.literal("show"), id, at: time, duration: z.number().min(0).max(30).optional() }),
  z.object({ op: z.literal("hide"), id, at: time, duration: z.number().min(0).max(30).optional() }),
  z.object({
    op: z.literal("camera"),
    zoom: z.number().min(0.1).max(20).optional(),
    x: num.optional(),
    y: num.optional(),
    at: time,
    duration: z.number().min(0).max(120).optional(),
    ease: easeSchema.optional(),
  }),
  z.object({
    op: z.literal("update"),
    id,
    set: z
      .object({
        name: z.string().max(60),
        x: num,
        y: num,
        rotation: num,
        scale: z.number().min(0.05).max(20),
        opacity: z.number().min(0).max(1),
        color: color,
        lineWidth: z.number().min(1).max(40),
        text: z.string().max(4000),
        size: z.number().min(4).max(400),
        font: z.enum(FONTS),
        bold: z.boolean(),
        parts: z.array(partSchema).min(1).max(400),
        w: z.number().positive(),
        h: z.number().positive(),
        target: id.nullable(),
        accent: color,
        density: z.number().min(0.05).max(5),
        kind: z.enum(EFFECT_KINDS),
        voice: z.enum([...VOICE_IDS, "none"]),
        thought: z.boolean(),
      })
      .partial(),
  }),
  z.object({ op: z.literal("remove"), id }),
  z.object({ op: z.literal("clearMotion"), id }),
  z.object({ op: z.literal("order"), id, to: z.enum(["front", "back", "forward", "backward"]) }),
  ...proOpSchemas,
]);

export type Op = z.infer<typeof opSchema>;

const CREATE_OPS = ["draw", "text", "character", "creature", "rig", "puppet", "image", "effect", "prop", "light"];

export interface OpResult {
  ok: boolean;
  message: string;
}

export interface ApplyOutcome {
  scene: Scene;
  results: OpResult[];
  /** Ops that parsed and applied, in order. */
  applied: Op[];
  /** Assets the ops created (AI-drawn SVGs). */
  newAssets: Asset[];
}

/** Apply ops to a copy of the scene. Invalid ops are skipped with a reason. */
export function applyOps(scene: Scene, rawOps: unknown[], assets: AssetInfo[] = []): ApplyOutcome {
  const next = cloneScene(scene);
  const results: OpResult[] = [];
  const applied: Op[] = [];
  const pro: ProContext = { assets, newAssets: [] };
  for (const raw of rawOps) {
    const parsed = opSchema.safeParse(raw);
    if (!parsed.success) {
      const op = (raw as { op?: unknown })?.op;
      results.push({ ok: false, message: `${String(op ?? "?")}: ${formatZodError(parsed.error)}` });
      continue;
    }
    try {
      const message = applyOne(next, parsed.data, assets, pro);
      const extra = raw as { z?: unknown; depth?: unknown; id?: unknown };
      if (CREATE_OPS.includes(parsed.data.op) && typeof extra.id === "string") {
        const created = findObj(next, extra.id);
        if (created && typeof extra.z === "number" && Number.isFinite(extra.z)) created.tracks.z = [{ t: 0, v: extra.z }];
        if (created?.type === "drawing" && typeof extra.depth === "number" && extra.depth > 0) created.depth = Math.min(2000, extra.depth);
      }
      results.push({ ok: true, message });
      applied.push(parsed.data);
    } catch (err) {
      results.push({ ok: false, message: `${parsed.data.op}: ${(err as Error).message}` });
    }
  }
  extendDuration(next);
  return { scene: next, results, applied, newAssets: pro.newAssets };
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "op"} ${i.message}`)
    .join("; ");
}

/** Make sure the video is long enough to show every animation. */
function extendDuration(scene: Scene) {
  let end = Math.max(lastKeyTime(scene.camera.tracks), proEnd(scene) - 0.5);
  for (const o of scene.objects) end = Math.max(end, lastKeyTime(o.tracks));
  if (end + 0.5 > scene.duration) scene.duration = Math.ceil((end + 0.5) * 10) / 10;
}

function need(scene: Scene, objId: string): SceneObj {
  const obj = findObj(scene, objId);
  if (!obj) throw new Error(`no object with id "${objId}"`);
  return obj;
}

function needSpeaker(scene: Scene, objId: string): StickmanObj | CreatureObj {
  const obj = need(scene, objId);
  if (obj.type !== "stickman" && obj.type !== "creature") throw new Error(`"${objId}" is a ${obj.type}; only characters and animals speak`);
  return obj;
}

/** Track name for a bone or joint on this kind of object. */
function trackName(obj: SceneObj, name: string): string {
  if (obj.type !== "creature") return name;
  return ["rootY", "mouth", "eyes", "x", "y", "rotation", "scale", "opacity", "squash"].includes(name) || name.startsWith("b.") ? name : `b.${name}`;
}

function needStickman(scene: Scene, objId: string): StickmanObj {
  const obj = need(scene, objId);
  if (obj.type !== "stickman") throw new Error(`"${objId}" is a ${obj.type}, not a character`);
  return obj;
}

function anim(obj: SceneObj, prop: string, to: number, at: number, dur: number, e: Ease = "easeInOut") {
  animateTrack(obj.tracks, prop, baseValue(obj, prop), to, at, dur, e);
}

/** Put a new object in place (or replace one with the same id, keeping its layer). */
function place(scene: Scene, obj: SceneObj): "added" | "replaced" {
  const i = scene.objects.findIndex((o) => o.id === obj.id);
  if (i >= 0) {
    scene.objects[i] = obj;
    return "replaced";
  }
  scene.objects.push(obj);
  return "added";
}

function appear(obj: SceneObj, at: number | undefined) {
  if (at && at > 0) {
    obj.tracks.opacity = [
      { t: 0, v: 0 },
      { t: at, v: 1, e: "step" },
    ];
  }
}

const baseObj = (objId: string, name: string, x: number, y: number) => ({
  id: objId,
  name,
  x,
  y,
  rotation: 0,
  scale: 1,
  opacity: 1,
  tracks: {},
});

function applyOne(scene: Scene, op: Op, assets: AssetInfo[], pro: ProContext): string {
  switch (op.op) {
    case "scene": {
      if (op.background !== undefined) scene.background = op.background;
      if (op.duration !== undefined) scene.duration = op.duration;
      if (op.fps !== undefined) scene.fps = op.fps;
      if (op.width !== undefined) scene.width = op.width + (op.width % 2);
      if (op.height !== undefined) {
        scene.height = op.height + (op.height % 2);
        scene.ground = Math.round(scene.height * 0.86);
      }
      if (op.backgroundImage !== undefined) {
        scene.backgroundImage = op.backgroundImage === null ? null : findAsset(assets, op.backgroundImage).id;
      }
      if (op.mode !== undefined) scene.mode = op.mode;
      if (op.lighting !== undefined) scene.lighting = op.lighting;
      if (op.look3d !== undefined) scene.look3d = op.look3d;
      if (op.floor !== undefined) scene.floor = op.floor;
      return op.mode ? `switched the scene to ${op.mode.toUpperCase()}` : "updated the scene settings";
    }
    case "draw": {
      const obj: SceneObj = { ...baseObj(op.id, op.name ?? op.id, op.x, op.y), type: "drawing", parts: op.parts as Part[] };
      appear(obj, op.at);
      if (op.drawOn && op.drawOn > 0) {
        obj.tracks.reveal = [
          { t: 0, v: 0 },
          { t: op.at ?? 0, v: 0 },
          { t: (op.at ?? 0) + op.drawOn, v: 1 },
        ];
      }
      return `${place(scene, obj)} drawing "${obj.name}"`;
    }
    case "text": {
      const obj: SceneObj = {
        ...baseObj(op.id, op.id, op.x, op.y),
        type: "text",
        text: op.text,
        size: op.size ?? 40,
        color: op.color ?? "#1a1a1a",
        font: op.font ?? "sans",
        align: op.align ?? "left",
        bold: op.bold ?? false,
      };
      appear(obj, op.at);
      if (op.typeOn && op.typeOn > 0) {
        obj.tracks.reveal = [
          { t: 0, v: 0 },
          { t: op.at ?? 0, v: 0 },
          { t: (op.at ?? 0) + op.typeOn, v: 1 },
        ];
      }
      return `${place(scene, obj)} text "${truncate(op.text)}"`;
    }
    case "character": {
      const obj: StickmanObj = {
        ...baseObj(op.id, op.name ?? op.id, op.x, op.y ?? scene.ground),
        scale: op.scale ?? 1.25,
        type: "stickman",
        color: op.color ?? "#1a1a1a",
        lineWidth: op.lineWidth ?? 6,
        facing: op.facing === "left" ? -1 : 1,
        pose: { ...STAND, ...(POSES[(op.pose ?? "stand") as PoseName] ?? {}) },
        expression: op.expression ?? "none",
      };
      if (op.look) obj.look = { ...DEFAULT_LOOK, ...op.look, style: op.look.style ?? "cartoon", cutout: null };
      if (op.voice) obj.voice = op.voice;
      appear(obj, op.at);
      return `${place(scene, obj)} character "${obj.name}"${obj.look ? ` (${obj.look.style})` : ""}`;
    }
    case "creature": {
      const defaults = SPECIES_DEFAULTS[op.species];
      const obj: CreatureObj = {
        ...baseObj(op.id, op.name ?? op.id, op.x, op.y ?? (op.species === "fish" ? scene.height / 2 : scene.ground)),
        type: "creature",
        species: op.species,
        color: op.color ?? defaults.color,
        accent: op.accent ?? defaults.accent,
        scale: op.scale ?? 1.3,
        facing: op.facing === "left" ? -1 : 1,
        rig: null,
        voice: op.voice ?? (op.species === "fish" ? "boy" : op.species),
      };
      appear(obj, op.at);
      place(scene, obj);
      if (op.pose && op.pose !== "stand") creaturePose(obj, op.pose, 0, 0);
      return `added ${op.species} "${obj.name}"`;
    }
    case "rig": {
      const names = new Set<string>();
      for (const b of op.bones) {
        if (names.has(b.name)) throw new Error(`bone "${b.name}" is listed twice`);
        if (b.parent && !op.bones.some((o) => o.name === b.parent)) throw new Error(`bone "${b.name}" has unknown parent "${b.parent}"`);
        names.add(b.name);
      }
      const obj: CreatureObj = {
        ...baseObj(op.id, op.name ?? op.id, op.x, op.y ?? scene.ground),
        type: "creature",
        species: "custom",
        color: "#1a1a1a",
        accent: "#1a1a1a",
        scale: op.scale ?? 1,
        facing: op.facing === "left" ? -1 : 1,
        rig: op.bones.map((b) => ({ ...b, parent: b.parent ?? null, parts: b.parts as Part[] })),
        voice: op.voice,
      };
      appear(obj, op.at);
      return `${place(scene, obj)} custom creature "${obj.name}" (${op.bones.length} bones)`;
    }
    case "puppet": {
      const asset = findAsset(assets, op.asset);
      if (!asset.joints) throw new Error(`picture "${asset.name}" has no puppet joints yet; the user sets them with "Make a character" on the picture`);
      const obj: StickmanObj = {
        ...baseObj(op.id, op.name ?? asset.name, op.x, op.y ?? scene.ground),
        scale: op.scale ?? 1.25,
        type: "stickman",
        color: "#1a1a1a",
        lineWidth: 6,
        facing: op.facing === "left" ? -1 : 1,
        pose: { ...STAND },
        expression: "none",
        look: { ...DEFAULT_LOOK, style: "cutout", cutout: { asset: asset.id, joints: asset.joints } },
        voice: op.voice,
      };
      appear(obj, op.at);
      return `${place(scene, obj)} picture character "${obj.name}"`;
    }
    case "look": {
      const obj = needStickman(scene, op.id);
      const current = obj.look ?? DEFAULT_LOOK;
      const style = op.set.style ?? (current.style === "stick" ? "cartoon" : current.style);
      if (style === "cutout" && !current.cutout) throw new Error("a picture look needs the puppet op with an imported picture");
      obj.look = { ...current, ...op.set, style };
      if (op.voice) obj.voice = op.voice;
      return `restyled ${op.id} (${style})`;
    }
    case "bones": {
      const obj = need(scene, op.id);
      const dur = op.duration ?? 0.4;
      for (const [name, v] of Object.entries(op.bones)) anim(obj, trackName(obj, name), v, op.at, dur, op.ease);
      return `posed ${op.id} at ${fmt(op.at)}s`;
    }
    case "cycle": {
      const obj = need(scene, op.id);
      const end = cycleTracks(obj, Object.fromEntries(Object.entries(op.bones).map(([k, v]) => [trackName(obj, k), v])), op.period, op.at, op.duration, op.phaseStep ?? 0);
      return `${op.id} repeats a motion (${fmt(op.at)}s → ${fmt(end)}s)`;
    }
    case "hold":
      return holdItem(scene, need(scene, op.id), op.item, op.hand ?? "right", op.at, op.follow ?? "position");
    case "drop":
      return releaseItem(scene, need(scene, op.id), op.at, op.fall ?? true);
    case "detach":
      return releaseItem(scene, need(scene, op.id), op.at, false);
    case "attach":
      return attachTo(scene, need(scene, op.id), op.to, op.anchor, op.at, op.follow ?? "position");
    case "effect": {
      const obj: EffectObj = {
        ...baseObj(op.id, op.name ?? op.kind, op.x ?? 0, op.y ?? 0),
        type: "effect",
        kind: op.kind,
        w: op.w ?? scene.width,
        h: op.h ?? scene.height,
        density: op.density ?? 1,
        color: op.color ?? null,
        seed: [...op.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7),
      };
      appear(obj, op.at);
      if (op.until !== undefined && op.until > (op.at ?? 0)) animateTrack(obj.tracks, "opacity", 1, 0, op.until, 0.6, "easeInOut");
      return `${place(scene, obj)} ${op.kind} effect`;
    }
    case "bounce": {
      const obj = need(scene, op.id);
      const end = bounce(obj, op.at, op.height ?? 140, op.times ?? 3, op.squash ?? true);
      return `${op.id} bounces (${fmt(op.at)}s → ${fmt(end)}s)`;
    }
    case "path": {
      const obj = need(scene, op.id);
      followPath(obj, op.points, op.at, op.duration, op.ease ?? "easeInOut", op.orient ?? false);
      return `${op.id} moves along a path (${fmt(op.at)}s → ${fmt(op.at + op.duration)}s)`;
    }
    case "shake": {
      const tracks = op.id ? need(scene, op.id).tracks : scene.camera.tracks;
      const baseX = op.id ? baseValue(need(scene, op.id), "x") : cameraBase(scene, "x");
      const baseY = op.id ? baseValue(need(scene, op.id), "y") : cameraBase(scene, "y");
      shakeTracks(tracks, baseX, baseY, op.at, op.duration ?? 0.5, op.strength ?? 12);
      return `${op.id ?? "camera"} shakes at ${fmt(op.at)}s`;
    }
    case "fly": {
      const obj = need(scene, op.id);
      if (obj.type === "creature" && obj.species === "bird") {
        const end = birdFlyTo(obj, op.x, op.y, op.at, op.duration);
        return `${op.id} flies to (${Math.round(op.x)}, ${Math.round(op.y)}) (${fmt(op.at)}s → ${fmt(end)}s)`;
      }
      const x0 = valueAt(obj, "x", op.at);
      const y0 = valueAt(obj, "y", op.at);
      const dur = op.duration ?? Math.max(0.8, Math.hypot(op.x - x0, op.y - y0) / 300);
      const lift = Math.min(160, 50 + Math.abs(op.x - x0) * 0.25);
      if (obj.type === "stickman" || obj.type === "creature") setFacingAny(obj, op.x < x0 ? -1 : 1, op.at);
      followPath(obj, [x0, y0, (x0 + op.x) / 2, Math.min(y0, op.y) - lift, op.x, op.y], op.at, dur, "easeInOut", false);
      return `${op.id} flies to (${Math.round(op.x)}, ${Math.round(op.y)})`;
    }
    case "image": {
      const asset = findAsset(assets, op.asset);
      let w = op.w;
      let h = op.h;
      if (w && !h) h = (w * asset.h) / asset.w;
      if (h && !w) w = (h * asset.w) / asset.h;
      const obj: SceneObj = { ...baseObj(op.id, asset.name, op.x, op.y), type: "image", asset: asset.id, w: w ?? asset.w, h: h ?? asset.h };
      appear(obj, op.at);
      return `${place(scene, obj)} picture "${asset.name}"`;
    }
    case "say": {
      if (op.character) needSpeaker(scene, op.character);
      let bubbleId = op.id ?? `say_${op.character ?? "note"}_${Math.round(op.at * 10)}`;
      if (!op.id) while (findObj(scene, bubbleId)) bubbleId += "b";
      const words = op.text.split(/\s+/).length;
      const dur = op.duration ?? Math.max(1.5, Math.min(8, 0.8 + words * 0.35));
      const obj: SceneObj = {
        ...baseObj(bubbleId, `"${truncate(op.text, 18)}"`, op.x ?? 0, op.y ?? 0),
        type: "bubble",
        text: op.text,
        target: op.character ?? null,
        size: 24,
        thought: op.thought ?? false,
      };
      if (op.voice) obj.voice = op.voice;
      if (!op.character && op.x === undefined) obj.x = scene.width / 2;
      if (!op.character && op.y === undefined) obj.y = 60;
      obj.tracks.opacity = [
        { t: 0, v: 0 },
        { t: op.at, v: 1, e: "step" },
        { t: op.at + dur, v: 0, e: "step" },
      ];
      if (op.at === 0) obj.tracks.opacity.shift();
      obj.tracks.reveal = [
        { t: op.at, v: 0 },
        { t: op.at + Math.min(dur * 0.5, op.text.length * 0.035), v: 1 },
      ];
      place(scene, obj);
      if (op.character && !op.thought) {
        const who = needSpeaker(scene, op.character);
        if (who.type === "stickman" && !hasKeysBetween(who, op.at, op.at + dur)) playAction(who, "talk", op.at, { times: Math.max(1, Math.round(dur / 1.4)) });
        if (who.type === "creature" && (obj.voice === "none" || who.voice === undefined)) cycleTracks(who, { mouth: 0.5 }, 0.3, op.at, dur);
      }
      return `${op.character ?? "narrator"} says "${truncate(op.text)}" at ${fmt(op.at)}s`;
    }
    case "move": {
      const obj = need(scene, op.id);
      const dur = op.duration ?? 1;
      if (op.x !== undefined) anim(obj, "x", op.x, op.at, dur, op.ease);
      if (op.y !== undefined) anim(obj, "y", op.y, op.at, dur, op.ease);
      if (op.z !== undefined) anim(obj, "z", op.z, op.at, dur, op.ease);
      return `moved ${op.id} at ${fmt(op.at)}s`;
    }
    case "shot":
      return planShot(scene, op.kind, op.at, op.duration, op.target, op.target2);
    case "direct":
      return directScene(scene, op.from ?? 0);
    case "prop": {
      const lit = op.lit ?? (scene.lighting === "night" || scene.lighting === "golden");
      const parts = buildProp(op.kind, { color: op.color, color2: op.color2, w: op.w, h: op.h, text: op.text, lit });
      const obj: SceneObj = { ...baseObj(op.id, op.name ?? op.kind, op.x, op.y ?? scene.ground), type: "drawing", parts };
      if (op.scale !== undefined) obj.scale = op.scale;
      if (op.z !== undefined) obj.tracks.z = [{ t: 0, v: op.z }];
      if (op.yaw !== undefined) obj.tracks.yaw = [{ t: 0, v: op.yaw }];
      appear(obj, op.at);
      const placed = place(scene, obj);
      const lamp = PROP_LIGHTS[op.kind];
      if (lamp && (lit || op.kind === "streetlight" || op.kind === "campfire")) {
        const k = op.scale ?? 1;
        const light: LightObj = {
          ...baseObj(`${op.id}_light`, `${op.name ?? op.kind} light`, op.x + lamp.x * k, (op.y ?? scene.ground) + lamp.y * k),
          type: "light",
          kind: "point",
          color: lamp.color,
          intensity: lamp.intensity,
          distance: lamp.distance * k,
        };
        light.tracks.z = [{ t: 0, v: (op.z ?? 0) + lamp.z * k }];
        appear(light, op.at);
        place(scene, light);
        linkKeepingPlace(scene, light, obj, "origin", 0, "position", false);
      }
      return `${placed} ${op.kind}${op.name ? ` "${op.name}"` : ""}`;
    }
    case "light": {
      const light: LightObj = {
        ...baseObj(op.id, op.id, op.x, op.y),
        type: "light",
        kind: op.kind ?? "point",
        color: op.color ?? "#fff1d6",
        intensity: op.intensity ?? 1.5,
        distance: op.distance ?? 900,
      };
      if (op.z !== undefined) light.tracks.z = [{ t: 0, v: op.z }];
      appear(light, op.at);
      return `${place(scene, light)} light "${op.id}"`;
    }
    case "turn": {
      const obj = need(scene, op.id);
      anim(obj, "yaw", op.yaw, op.at, op.duration ?? 0.4, "easeInOut");
      return `${op.id} turns to ${Math.round(op.yaw)}° at ${fmt(op.at)}s`;
    }
    case "camera3d": {
      const tracks = (scene.camera3d ??= { tracks: {} }).tracks;
      const dur = op.duration ?? 1;
      const set = (prop: string, v: number | undefined) => {
        if (v !== undefined) animateTrack(tracks, prop, camera3dBase(scene, prop), v, op.at, dur, op.ease ?? "easeInOut");
      };
      set("yaw", op.yaw);
      set("pitch", op.pitch);
      set("dist", op.distance);
      set("tx", op.x);
      set("ty", op.y);
      set("tz", op.z);
      set("fov", op.fov);
      return `3D camera move at ${fmt(op.at)}s`;
    }
    case "orbit": {
      const tracks = (scene.camera3d ??= { tracks: {} }).tracks;
      const from = tracks.yaw?.length ? valueAt({ tracks } as unknown as SceneObj, "yaw", op.at) : camera3dBase(scene, "yaw");
      animateTrack(tracks, "yaw", camera3dBase(scene, "yaw"), from + op.degrees, op.at, op.duration, "easeInOut");
      return `camera orbits ${op.degrees}° (${fmt(op.at)}s → ${fmt(op.at + op.duration)}s)`;
    }
    case "sound": {
      let soundId = op.id ?? `sfx_${op.kind}_${Math.round(op.at * 10)}`;
      if (!op.id) while (findObj(scene, soundId)) soundId += "b";
      const ambience = op.kind === "rain" || op.kind === "wind";
      const obj: SoundObj = {
        ...baseObj(soundId, `${op.kind} sound`, 0, 0),
        type: "sound",
        kind: op.kind,
        at: op.at,
        duration: op.duration ?? (ambience ? Math.max(1, scene.duration - op.at) : 1),
        volume: op.volume ?? 1,
      };
      place(scene, obj);
      return `${op.kind} sound at ${fmt(op.at)}s`;
    }
    case "walk": {
      const any = need(scene, op.id);
      if (any.type !== "stickman" && any.type !== "creature") throw new Error(`"${op.id}" is a ${any.type}; use move or path for objects`);
      let x = op.x;
      if (op.to) x = standBeside(scene, any, op.to, op.at, op.side ?? "auto");
      if (x === undefined) throw new Error("walk needs x or to");
      x = Math.max(20, Math.min(scene.width - 20, x));
      if (any.type === "creature") {
        if (any.species === "bird" && op.style === "fly") {
          const end = birdFlyTo(any, x, valueAt(any, "y", op.at), op.at, op.duration);
          return `${op.id} flies to x=${Math.round(x)} (${fmt(op.at)}s → ${fmt(end)}s)`;
        }
        const end = creatureMove(any, x, op.at, op.duration, op.style ?? "walk");
        if (op.to) faceToward(scene, any, op.to, end);
        const verb = any.species === "fish" ? "swims" : any.species === "bird" ? "hops" : `${op.style ?? "walk"}s`;
        return `${op.id} ${verb} to ${op.to ?? `x=${Math.round(x)}`} (${fmt(op.at)}s → ${fmt(end)}s)`;
      }
      const obj = any;
      if (op.style === "fly") throw new Error("only birds fly with walk; use the fly op for others");
      if (op.z !== undefined && !op.to) {
        const x0 = valueAt(obj, "x", op.at);
        const z0 = valueAt(obj, "z", op.at);
        const dx = x - x0;
        const dz = op.z - z0;
        const dist = Math.hypot(dx, dz);
        const dir: 1 | -1 = dx < -1 ? -1 : 1;
        // The 2D walk makes the legs; x and z are then laid along the real path.
        const r3 = walkTo(obj, x0 + dir * Math.max(dist, 2), op.at, op.duration, op.style ?? "walk");
        const walkEnd = r3.end - 0.25;
        anim(obj, "x", x, op.at, walkEnd - op.at, "linear");
        anim(obj, "z", op.z, op.at, walkEnd - op.at, "linear");
        const heading = (Math.atan2(dz, dx) * 180) / Math.PI;
        anim(obj, "yaw", dir < 0 ? heading - 180 : heading, op.at, 0.2, "easeInOut");
        return `${op.id} walks to (${Math.round(x)}, z ${Math.round(op.z)}) (${fmt(op.at)}s → ${fmt(r3.end)}s)`;
      }
      const r = walkTo(obj, x, op.at, op.duration, op.style ?? "walk");
      if (op.to) faceToward(scene, obj, op.to, r.end);
      return `${op.id} ${op.style ?? "walk"}s to ${op.to ? `${op.to} (x=${Math.round(x)})` : `x=${Math.round(x)}`} (${fmt(op.at)}s → ${fmt(r.end)}s)`;
    }
    case "write": {
      const obj = needStickman(scene, op.id);
      const board = need(scene, op.on);
      if (board.type !== "drawing" && board.type !== "image") throw new Error(`"${op.on}" is a ${board.type}; write on a drawing or picture`);
      let start = op.at;
      const b = objectBounds(undefined, scene, board, start);
      const gap = edgeDistance(valueAt(obj, "x", start), b);
      if (gap > 45 * obj.scale) {
        const x = Math.max(20, Math.min(scene.width - 20, standBeside(scene, obj, op.on, start, "auto")));
        start = walkTo(obj, x, start, undefined, "walk").end;
      }
      faceToward(scene, obj, op.on, start);
      const lines = op.text.split("\n");
      const longest = Math.max(...lines.map((l) => l.length), 1);
      const inner = { x: b.x + b.w * 0.1, y: b.y + b.h * 0.12, w: b.w * 0.8, h: b.h * 0.76 };
      const size = Math.max(10, Math.floor(Math.min(op.size ?? 72, inner.h / (lines.length * 1.25), inner.w / (longest * 0.58))));
      const textH = lines.length * size * 1.25;
      const textId = op.textId ?? uniqueId(scene, `${op.on}_text`);
      const typeDur = Math.max(0.8, Math.min(8, op.text.length * 0.12));
      const obj2: SceneObj = {
        ...baseObj(textId, `"${truncate(op.text, 18)}"`, inner.x + inner.w / 2, inner.y + (inner.h - textH) / 2),
        type: "text",
        text: op.text,
        size,
        color: op.color ?? (isDark(boardColor(board)) ? "#f4f4f0" : "#1a1a1a"),
        font: "chalk",
        align: "center",
        bold: false,
      };
      const writeStart = start + 0.3;
      obj2.tracks.opacity = writeStart > 0 ? [{ t: 0, v: 0 }, { t: writeStart, v: 1, e: "step" }] : [];
      if (!obj2.tracks.opacity.length) delete obj2.tracks.opacity;
      obj2.tracks.reveal = [{ t: writeStart, v: 0 }, { t: writeStart + typeDur, v: 1 }];
      // In 3D the writing sits on the board's front face, not inside it.
      if (board.type === "drawing") {
        const front = Math.max(0, ...board.parts.map((p) => (p.kind === "box3" || p.kind === "prism3" ? (p.z ?? 0) + p.d / 2 : 0)));
        const bz = valueAt(board, "z", start);
        if (front || bz) obj2.tracks.z = [{ t: 0, v: bz + front + 1 }];
      }
      place(scene, obj2);
      const end = playAction(obj, "write", start, { duration: typeDur + 0.6 });
      return `${op.id} writes "${truncate(op.text)}" on ${op.on} (${fmt(start)}s → ${fmt(end)}s, text id ${textId})`;
    }
    case "pose": {
      const any = need(scene, op.id);
      if (any.type === "creature") {
        if (!(CREATURE_POSES as readonly string[]).includes(op.pose)) throw new Error(`a ${any.species} can only ${CREATURE_POSES.join(", ")}`);
        const end = creaturePose(any, op.pose as CreaturePose, op.at, op.duration ?? 0.5);
        return `${op.id} ${op.pose} (${fmt(op.at)}s → ${fmt(end)}s)`;
      }
      const obj = needStickman(scene, op.id);
      if (!(POSE_NAMES as readonly string[]).includes(op.pose)) throw new Error(`"${op.pose}" is an animal pose; characters use ${POSE_NAMES.join(", ")}`);
      const pose = op.pose as PoseName;
      if (op.on) return sitOn(scene, obj, op.on, op.at, pose, op.duration ?? 0.5);
      const end = transitionToPose(obj, pose, op.at, op.duration ?? 0.4);
      return `${op.id} ${op.pose} (${fmt(op.at)}s → ${fmt(end)}s)`;
    }
    case "joints": {
      const obj = needStickman(scene, op.id);
      const dur = op.duration ?? 0.4;
      for (const [name, v] of Object.entries(op.joints)) if (v !== undefined) anim(obj, name, v, op.at, dur, op.ease);
      return `posed ${op.id} at ${fmt(op.at)}s`;
    }
    case "action": {
      const any = need(scene, op.id);
      if (any.type === "creature") {
        if (!(CREATURE_ACTIONS as readonly string[]).includes(op.action)) throw new Error(`a ${any.species} can't ${op.action} (it can: ${creatureActionsFor(any.species).join(", ")})`);
        const end = playCreatureAction(any, op.action as CreatureAction, op.at, op.times ?? 2);
        return `${op.id} ${op.action} (${fmt(op.at)}s → ${fmt(end)}s)`;
      }
      const obj = needStickman(scene, op.id);
      if (!(ACTIONS as readonly string[]).includes(op.action)) throw new Error(`characters can't ${op.action}; they can ${ACTIONS.join(", ")}`);
      const end = playAction(obj, op.action as ActionName, op.at, { times: op.times, duration: op.duration });
      return `${op.id} ${op.action} (${fmt(op.at)}s → ${fmt(end)}s)`;
    }
    case "face": {
      const obj = need(scene, op.id);
      if (obj.type !== "stickman" && obj.type !== "creature") throw new Error(`"${op.id}" is a ${obj.type}; only characters and animals turn`);
      if (op.toward) {
        faceToward(scene, obj, op.toward, op.at);
        return `${op.id} turns toward ${op.toward} at ${fmt(op.at)}s`;
      }
      if (!op.direction) throw new Error("face needs direction or toward");
      setFacingAny(obj, op.direction === "left" ? -1 : 1, op.at);
      return `${op.id} faces ${op.direction} at ${fmt(op.at)}s`;
    }
    case "expression": {
      const obj = needStickman(scene, op.id);
      setExpression(obj, op.expression, op.at);
      return `${op.id} looks ${op.expression} at ${fmt(op.at)}s`;
    }
    case "animate": {
      const obj = need(scene, op.id);
      anim(obj, op.prop, op.to, op.at, op.duration ?? 1, op.ease);
      return `animated ${op.id} ${op.prop} → ${op.to}`;
    }
    case "show":
    case "hide": {
      const obj = need(scene, op.id);
      const to = op.op === "show" ? 1 : 0;
      const dur = op.duration ?? 0;
      anim(obj, "opacity", to, op.at, dur, dur ? "easeInOut" : "step");
      return `${op.op === "show" ? "shows" : "hides"} ${op.id} at ${fmt(op.at)}s`;
    }
    case "camera": {
      const dur = op.duration ?? 1;
      const set = (prop: string, v: number | undefined) => {
        if (v !== undefined) animateTrack(scene.camera.tracks, prop, cameraBase(scene, prop), v, op.at, dur, op.ease ?? "easeInOut");
      };
      set("zoom", op.zoom);
      set("x", op.x);
      set("y", op.y);
      return `camera ${op.zoom ? `zoom ${op.zoom}× ` : ""}at ${fmt(op.at)}s`;
    }
    case "update": {
      const obj = need(scene, op.id);
      const s = op.set;
      const fields = Object.keys(s);
      if (!fields.length) throw new Error("update has nothing in set");
      for (const prop of ["x", "y", "rotation", "scale", "opacity"] as const) {
        if (s[prop] === undefined) continue;
        // On an animated property, shift the whole path so the change is actually visible.
        const keys = obj.tracks[prop];
        if (keys?.length && (prop === "x" || prop === "y")) {
          const delta = s[prop]! - obj[prop];
          for (const k of keys) k.v += delta;
        } else if (keys?.length) {
          delete obj.tracks[prop];
        }
        obj[prop] = s[prop]!;
      }
      if (s.name !== undefined) obj.name = s.name;
      if (obj.type === "stickman") {
        if (s.color !== undefined) obj.color = s.color;
        if (s.lineWidth !== undefined) obj.lineWidth = s.lineWidth;
        if (s.voice !== undefined && s.voice !== "none") obj.voice = s.voice;
      }
      if (obj.type === "creature") {
        if (s.color !== undefined) obj.color = s.color;
        if (s.accent !== undefined) obj.accent = s.accent;
        if (s.voice !== undefined && s.voice !== "none") obj.voice = s.voice;
      }
      if (obj.type === "effect") {
        if (s.density !== undefined) obj.density = s.density;
        if (s.kind !== undefined) obj.kind = s.kind;
        if (s.color !== undefined) obj.color = s.color;
        if (s.w !== undefined) obj.w = s.w;
        if (s.h !== undefined) obj.h = s.h;
      }
      if (obj.type === "text") {
        if (s.text !== undefined) obj.text = s.text;
        if (s.size !== undefined) obj.size = s.size;
        if (s.color !== undefined) obj.color = s.color;
        if (s.font !== undefined) obj.font = s.font;
        if (s.bold !== undefined) obj.bold = s.bold;
      }
      if (obj.type === "bubble") {
        // A recording only goes stale when what is said, or who says it, really changes.
        if ((s.text !== undefined && s.text !== obj.text) || (s.voice !== undefined && s.voice !== obj.voice)) obj.audio = null;
        if (s.text !== undefined) obj.text = s.text;
        if (s.size !== undefined) obj.size = s.size;
        if (s.target !== undefined) obj.target = s.target;
        if (s.thought !== undefined) obj.thought = s.thought;
        if (s.voice !== undefined) obj.voice = s.voice;
      }
      if (obj.type === "drawing" && s.parts) obj.parts = s.parts as Part[];
      if (obj.type === "image") {
        if (s.w !== undefined) obj.w = s.w;
        if (s.h !== undefined) obj.h = s.h;
      }
      return `changed ${fields.join(", ")} of ${op.id}`;
    }
    case "remove": {
      need(scene, op.id);
      scene.objects = scene.objects.filter((o) => o.id !== op.id);
      for (const o of scene.objects) {
        if (o.type === "bubble" && o.target === op.id) o.target = null;
        if (o.links?.some((l) => l.parent === op.id)) o.links = o.links.map((l) => (l.parent === op.id ? { ...l, parent: null } : l));
      }
      return `removed ${op.id}`;
    }
    case "clearMotion": {
      const obj = need(scene, op.id);
      obj.tracks = {};
      return `cleared the animation of ${op.id}`;
    }
    case "order": {
      const obj = need(scene, op.id);
      const i = scene.objects.indexOf(obj);
      scene.objects.splice(i, 1);
      const j = op.to === "front" ? scene.objects.length : op.to === "back" ? 0 : op.to === "forward" ? Math.min(scene.objects.length, i + 1) : Math.max(0, i - 1);
      scene.objects.splice(j, 0, obj);
      return `moved ${op.id} to the ${op.to}`;
    }
    default:
      return applyProOp(scene, op as ProOp, pro);
  }
}

/** Walk to a seat if needed, then sit with the hips resting on its top surface. */
function sitOn(scene: Scene, who: StickmanObj, seatId: string, at: number, pose: PoseName, dur: number): string {
  const seat = need(scene, seatId);
  if (seat.id === who.id) throw new Error("a character can't sit on itself");
  const b = objectBounds(undefined, scene, seat, at);
  let span = { x1: b.x, x2: b.x + b.w };
  let seatTop = b.y;
  if (seat.type === "drawing") {
    // A wide, flat rect near hip height is the seat (a chair back or table top is not).
    const g = valueAt(who, "y", at);
    const flat = seat.parts
      .filter((p): p is Extract<Part, { kind: "rect" | "box3" }> => (p.kind === "rect" || p.kind === "box3") && Math.abs(p.w) >= Math.abs(p.h) * 1.5)
      .map((p) => ({ x1: seat.x + Math.min(p.x, p.x + p.w) * seat.scale, x2: seat.x + Math.max(p.x, p.x + p.w) * seat.scale, top: seat.y + Math.min(p.y, p.y + p.h) * seat.scale }))
      .filter((p) => p.top > g - 110 * who.scale && p.top < g - 15);
    if (flat.length) {
      flat.sort((a, c) => c.top - a.top);
      span = { x1: flat[0].x1, x2: flat[0].x2 };
      seatTop = flat[0].top;
    }
  }
  const seatX = freeSeatSpot(scene, who, span, at);
  let start = at;
  if (Math.abs(valueAt(who, "x", start) - seatX) > 6) start = walkTo(who, seatX, start, undefined, "walk").end;
  const ground = valueAt(who, "y", start);
  const hipY = Math.max(0, Math.min(LEG - 5, (seatTop - who.lineWidth / 2 - ground) / who.scale + LEG));
  const target = { ...POSES.sit, ...(FULL_BODY_POSES.includes(pose) ? {} : POSES[pose]), hipY };
  for (const [name, v] of Object.entries(target)) anim(who, name, v, start, dur);
  return `${who.id} sits on ${seatId} (${fmt(start)}s → ${fmt(start + dur)}s)`;
}

/** Pick a spot on the seat that isn't already taken by someone sitting there. */
function freeSeatSpot(scene: Scene, who: StickmanObj, span: { x1: number; x2: number }, at: number): number {
  const spacing = 50 * who.scale;
  const center = (span.x1 + span.x2) / 2;
  const margin = Math.min(16 * who.scale, (span.x2 - span.x1) / 2);
  const taken: number[] = [];
  for (const other of scene.objects) {
    if (other.type !== "stickman" || other.id === who.id) continue;
    for (const t of [at, at + 1.5, scene.duration]) {
      const x = valueAt(other, "x", t);
      if (valueAt(other, "hipY", t) > 25 && x >= span.x1 - spacing / 2 && x <= span.x2 + spacing / 2) {
        taken.push(x);
        break;
      }
    }
  }
  if (!taken.length) return center;
  const candidates: number[] = [];
  for (let d = 0; d <= (span.x2 - span.x1) / 2; d += spacing / 4) {
    for (const x of d ? [center - d, center + d] : [center]) if (x >= span.x1 + margin && x <= span.x2 - margin) candidates.push(x);
  }
  const gap = (x: number) => Math.min(...taken.map((o) => Math.abs(o - x)));
  const cur = valueAt(who, "x", at);
  const free = candidates.filter((x) => gap(x) >= spacing);
  if (free.length) return free.sort((a, c) => Math.abs(a - cur) - Math.abs(c - cur))[0];
  return candidates.sort((a, c) => gap(c) - gap(a))[0] ?? center;
}

/** x where a character should stand to be right beside an object. */
function standBeside(scene: Scene, who: StickmanObj | CreatureObj, targetId: string, at: number, side: "left" | "right" | "auto"): number {
  let target = need(scene, targetId);
  if (target.id === who.id) throw new Error("a character can't walk to itself");
  // Walking to something that is being carried means walking to whoever carries it.
  const carrier = activeLink(target, at + 2)?.parent;
  if (carrier && carrier !== who.id) target = need(scene, carrier);
  const b = objectBounds(undefined, scene, target, at);
  const whoW = who.type === "creature" ? 60 * who.scale : 22 * who.scale;
  const gap = target.type === "stickman" || target.type === "creature" ? 30 * who.scale : 12;
  const leftX = b.x - gap - whoW;
  const rightX = b.x + b.w + gap + whoW;
  if (side === "left") return leftX;
  if (side === "right") return rightX;

  // Don't stop inside another character or animal standing there.
  const others = scene.objects.filter((o) => o.id !== who.id && o.id !== target.id && (o.type === "stickman" || o.type === "creature"));
  const blocked = (x: number) =>
    others.some((o) => {
      const ob = objectBounds(undefined, scene, o, at + 2);
      return x + whoW > ob.x && x - whoW < ob.x + ob.w;
    });
  const cur = valueAt(who, "x", at);
  const options = [leftX, rightX]
    .filter((x) => x > 20 && x < scene.width - 20)
    .sort((p, q) => Number(blocked(p)) - Number(blocked(q)) || Math.abs(cur - p) - Math.abs(cur - q));
  return options[0] ?? leftX;
}

function faceToward(scene: Scene, who: StickmanObj | CreatureObj, targetId: string, at: number) {
  const target = need(scene, targetId);
  const b = objectBounds(undefined, scene, target, at);
  const cx = b.x + b.w / 2;
  const dx = cx - worldState(scene, who, at).x;
  const dir: 1 | -1 = dx < 0 ? -1 : 1;
  setFacingAny(who, dir, at);
  // In 3D, also turn toward the target's depth.
  const dz = valueAt(target, "z", at) - valueAt(who, "z", at);
  if (Math.abs(dz) > 1 || who.tracks.yaw?.length) {
    const heading = (Math.atan2(dz, Math.abs(dx) < 1 ? 1 : dx) * 180) / Math.PI;
    animateTrack(who.tracks, "yaw", 0, dir < 0 ? heading - 180 : heading, at, 0.25, "easeInOut");
  }
}

function setFacingAny(who: StickmanObj | CreatureObj, dir: 1 | -1, at: number) {
  if (who.type === "stickman") return setFacing(who, dir, at);
  if (Math.sign(valueAt(who, "facing", at)) === dir) return;
  animateTrack(who.tracks, "facing", baseValue(who, "facing"), dir, at, 0, "step");
}

/** Oscillate tracks around their value at start (period in seconds, amplitude per track). */
function cycleTracks(obj: SceneObj, amps: Record<string, number>, period: number, start: number, duration: number, phaseStep = 0): number {
  const quarter = period / 4;
  const count = Math.max(1, Math.round(duration / quarter));
  Object.entries(amps).forEach(([prop, amp], bi) => {
    const base = valueAt(obj, prop, start);
    const shift = Math.round(phaseStep * bi * 4);
    let prev = start;
    for (let i = 1; i <= count; i++) {
      const t = start + i * quarter;
      const v = i === count ? base : base + amp * [0, 1, 0, -1][(i + shift) % 4];
      animateTrack(obj.tracks, prop, baseValue(obj, prop), v, prev, t - prev, "easeInOut");
      prev = t;
    }
  });
  return start + count * quarter;
}

function setLink(obj: SceneObj, link: NonNullable<SceneObj["links"]>[number]) {
  const links = (obj.links ?? []).filter((l) => Math.abs(l.t - link.t) > 1e-4);
  links.push(link);
  links.sort((a, b) => a.t - b.t);
  obj.links = links;
}

function stepTo(obj: SceneObj, prop: string, v: number, at: number) {
  animateTrack(obj.tracks, prop, baseValue(obj, prop), v, at, 0, "step");
}

/** Pin an object to a parent's anchor from `at`, keeping it exactly where it is. */
function linkKeepingPlace(scene: Scene, child: SceneObj, parent: SceneObj, anchor: string, at: number, follow: "position" | "full", snapCenter: boolean) {
  const a = anchorAt(scene, parent, anchor, at);
  const w = worldState(scene, child, at);
  let dx = w.x - a.x;
  let dy = w.y - a.y;
  if (snapCenter) {
    // Held things sit with their middle in the hand.
    const b = objectBounds(undefined, scene, child, at);
    dx = w.x - (b.x + b.w / 2);
    dy = w.y - (b.y + b.h / 2);
  }
  if (follow === "full") {
    const r = (-a.rotation * Math.PI) / 180;
    [dx, dy] = [dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r)];
    stepTo(child, "rotation", w.rotation - a.rotation, at);
  }
  setLink(child, { t: at, parent: parent.id, anchor, follow });
  stepTo(child, "x", dx, at);
  stepTo(child, "y", dy, at);
}

function holdItem(scene: Scene, who: SceneObj, itemId: string, hand: "left" | "right", at: number, follow: "position" | "full"): string {
  if (who.type !== "stickman" && who.type !== "creature") throw new Error(`"${who.id}" is a ${who.type}; only characters and animals hold things`);
  const item = need(scene, itemId);
  if (item.id === who.id) throw new Error("can't hold itself");
  if (item.type === "bubble" || item.type === "effect") throw new Error(`a ${item.type} can't be held`);
  let start = at;
  const alreadyHeld = activeLink(item, at);
  const b = objectBounds(undefined, scene, item, start);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;

  if (who.type === "creature") {
    if (!alreadyHeld && Math.abs(worldState(scene, who, start).x - cx) > 40 * who.scale) {
      start = creatureMove(who, cx - Math.sign(cx - worldState(scene, who, start).x) * 50 * who.scale, start, undefined, "walk");
    }
    setFacingAny(who, cx < worldState(scene, who, start).x ? -1 : 1, start);
    linkKeepingPlace(scene, item, who, "mouth", start + 0.1, follow, true);
    return `${who.id} picks up ${itemId} in its mouth at ${fmt(start + 0.1)}s`;
  }

  const side = hand === "left" ? "l" : "r";
  const whoX = worldState(scene, who, start).x;
  if (!alreadyHeld && Math.abs(cx - whoX) > 60 * who.scale) {
    const standX = cx + (whoX < cx ? -42 : 42) * who.scale;
    start = walkTo(who, Math.max(20, Math.min(scene.width - 20, standX)), start, undefined, "walk").end;
  }
  setFacing(who, cx < worldState(scene, who, start).x ? -1 : 1, start);
  const hip = stickmanTransform(who, start, scene).toWorld(stickmanPoints(who, start).hip);
  let grab = start + 0.3;
  if (!alreadyHeld && cy > hip.y) {
    // Low things: crouch down, grab, stand up.
    transitionToPose(who, "crouch", start, 0.35);
    animateTrack(who.tracks, `${side}Shoulder`, baseValue(who, `${side}Shoulder`), 75, start, 0.35);
    animateTrack(who.tracks, `${side}Elbow`, baseValue(who, `${side}Elbow`), 5, start, 0.35);
    grab = start + 0.4;
    transitionToPose(who, "stand", grab + 0.05, 0.35);
  } else {
    animateTrack(who.tracks, `${side}Shoulder`, baseValue(who, `${side}Shoulder`), 70, start, 0.3);
    animateTrack(who.tracks, `${side}Elbow`, baseValue(who, `${side}Elbow`), 10, start, 0.3);
  }
  // Carry it in front.
  animateTrack(who.tracks, `${side}Shoulder`, baseValue(who, `${side}Shoulder`), 35, grab + 0.05, 0.35);
  animateTrack(who.tracks, `${side}Elbow`, baseValue(who, `${side}Elbow`), 60, grab + 0.05, 0.35);
  linkKeepingPlace(scene, item, who, `${side}Hand`, grab, follow, true);
  return `${who.id} picks up ${itemId} (${fmt(start)}s → ${fmt(grab + 0.4)}s)`;
}

function releaseItem(scene: Scene, item: SceneObj, at: number, fall: boolean): string {
  const link = activeLink(item, at);
  if (!link) throw new Error(`"${item.id}" isn't held or attached at ${fmt(at)}s`);
  const w = worldState(scene, item, at);
  setLink(item, { t: at, parent: null, anchor: "", follow: "position" });
  stepTo(item, "x", w.x, at);
  stepTo(item, "y", w.y, at);
  stepTo(item, "rotation", w.rotation, at);
  if (!fall || item.type === "stickman" || item.type === "creature") return `${item.id} is let go at ${fmt(at)}s`;
  const b = objectBounds(undefined, scene, item, at);
  const drop = scene.ground - (b.y + b.h);
  if (drop > 2) {
    const dur = Math.sqrt((2 * drop) / 1800);
    animateTrack(item.tracks, "y", baseValue(item, "y"), w.y + drop, at, dur, "easeIn");
    animateTrack(item.tracks, "squash", 1, 0.8, at + dur, 0.06, "easeOut");
    animateTrack(item.tracks, "squash", 1, 1, at + dur + 0.06, 0.12, "easeOut");
  }
  return `${item.id} drops at ${fmt(at)}s`;
}

function attachTo(scene: Scene, child: SceneObj, parentId: string, anchor: string | undefined, at: number, follow: "position" | "full"): string {
  const parent = need(scene, parentId);
  if (parent.id === child.id) throw new Error("can't attach to itself");
  let p: SceneObj | undefined = parent;
  for (let d = 0; p && d < 6; d++) {
    const l = activeLink(p, at);
    if (l?.parent === child.id) throw new Error(`"${parentId}" is already attached to "${child.id}"`);
    p = l?.parent ? findObj(scene, l.parent) : undefined;
  }
  const a = anchor ?? (parent.type === "stickman" ? "hip" : parent.type === "creature" ? "back" : "origin");
  // The anchor has to be a point on the parent, not on the thing being attached.
  const valid =
    parent.type === "stickman"
      ? (STICKMAN_ANCHORS as readonly string[]).includes(a)
      : parent.type === "creature"
        ? a === "back" || a === "mouth" || rigOf(parent).some((b) => b.name === a)
        : a === "origin";
  if (!valid) {
    const hint = parent.type === "stickman" ? STICKMAN_ANCHORS.join(", ") : parent.type === "creature" ? "back, mouth or a bone name" : "origin";
    throw new Error(`"${parentId}" has no anchor "${a}" (it has: ${hint}). The anchor is a point on the thing you attach TO: to put a ball in a dog's mouth use {"op":"attach","id":"ball","to":"dog","anchor":"mouth"} or {"op":"hold","id":"dog","item":"ball"}`);
  }
  // Hands and mouths grip: the object moves into them instead of floating at a distance.
  linkKeepingPlace(scene, child, parent, a, at, follow, ["rHand", "lHand", "mouth"].includes(a));
  return `${child.id} is attached to ${parentId} (${a}) from ${fmt(at)}s`;
}

/** Bounces with decaying height, squashing on impact and stretching in the air. */
function bounce(obj: SceneObj, at: number, height: number, times: number, squash: boolean): number {
  const y0 = valueAt(obj, "y", at);
  const g = 1800;
  let t = at;
  for (let i = 0; i < times; i++) {
    const h = height * Math.pow(0.55, i);
    const up = Math.sqrt((2 * h) / g);
    if (squash) {
      animateTrack(obj.tracks, "squash", 1, 0.72, t, 0.07, "easeOut");
      animateTrack(obj.tracks, "squash", 1, 1.12, t + 0.07, 0.08, "easeOut");
      animateTrack(obj.tracks, "squash", 1, 1, t + 0.15, up - 0.08, "easeInOut");
    }
    const lift = t + (squash ? 0.07 : 0);
    animateTrack(obj.tracks, "y", baseValue(obj, "y"), y0 - h, lift, up, "easeOut");
    animateTrack(obj.tracks, "y", baseValue(obj, "y"), y0, lift + up, up, "easeIn");
    if (squash) animateTrack(obj.tracks, "squash", 1, 1.1, lift + up, up, "easeIn");
    t = lift + up * 2;
  }
  if (squash) {
    animateTrack(obj.tracks, "squash", 1, 0.8, t, 0.06, "easeOut");
    animateTrack(obj.tracks, "squash", 1, 1, t + 0.06, 0.15, "easeOut");
    t += 0.21;
  }
  return t;
}

/** Move smoothly through points (a Catmull-Rom curve), optionally turning to follow it. */
function followPath(obj: SceneObj, flat: number[], at: number, duration: number, e: Ease, orient: boolean) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) pts.push({ x: flat[i], y: flat[i + 1] });
  const cur = { x: valueAt(obj, "x", at), y: valueAt(obj, "y", at) };
  if (Math.hypot(pts[0].x - cur.x, pts[0].y - cur.y) > 2) pts.unshift(cur);
  const samples: { x: number; y: number; d: number }[] = [];
  const P = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let seg = 0; seg < pts.length - 1; seg++) {
    for (let k = 0; k < 20; k++) {
      const u = k / 20;
      const p0 = P(seg - 1), p1 = P(seg), p2 = P(seg + 1), p3 = P(seg + 2);
      const cr = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
      samples.push({ x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y), d: 0 });
    }
  }
  samples.push({ ...pts[pts.length - 1], d: 0 });
  for (let i = 1; i < samples.length; i++) samples[i].d = samples[i - 1].d + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
  const total = samples[samples.length - 1].d || 1;
  const at_ = (dist: number) => {
    let i = 1;
    while (i < samples.length - 1 && samples[i].d < dist) i++;
    const a = samples[i - 1], b = samples[i];
    const u = b.d > a.d ? (dist - a.d) / (b.d - a.d) : 0;
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
  };
  const count = Math.max(8, Math.ceil(duration * 15));
  const props = orient ? ["x", "y", "rotation"] : ["x", "y"];
  for (const prop of props) {
    const keys = obj.tracks[prop] ?? (obj.tracks[prop] = []);
    const startV = valueAt(obj, prop, at);
    if (!keys.length && at > 0) keys.push({ t: 0, v: baseValue(obj, prop) });
    removeKeys(keys, at, at + duration);
    upsertKey(keys, at, startV);
  }
  let lastAngle = valueAt(obj, "rotation", at);
  for (let k = 1; k <= count; k++) {
    const p = at_(easeFn(e, k / count) * total);
    const t = at + (duration * k) / count;
    upsertKey(obj.tracks.x, t, p.x);
    upsertKey(obj.tracks.y, t, p.y);
    if (orient) {
      let a = p.angle;
      while (a - lastAngle > 180) a -= 360;
      while (a - lastAngle < -180) a += 360;
      lastAngle = a;
      upsertKey(obj.tracks.rotation, t, a);
    }
  }
}

function shakeTracks(tracks: Tracks, baseX: number, baseY: number, at: number, duration: number, strength: number) {
  const steps = Math.max(2, Math.round(duration * 20));
  for (const [prop, base] of [["x", baseX], ["y", baseY]] as const) {
    const keys: Key[] = tracks[prop] ?? (tracks[prop] = []);
    const v0 = keys.length ? valueAtKeys(keys, at, base) : base;
    if (!keys.length && at > 0) keys.push({ t: 0, v: base });
    const vEnd = keys.length ? valueAtKeys(keys, at + duration, base) : base;
    removeKeys(keys, at, at + duration);
    upsertKey(keys, at, v0);
    for (let i = 1; i < steps; i++) {
      const decay = 1 - i / steps;
      const jitter = Math.sin(i * (prop === "x" ? 12.9898 : 78.233) + at * 7) * 43758.5453;
      const r = (jitter - Math.floor(jitter)) * 2 - 1;
      upsertKey(keys, at + (duration * i) / steps, v0 + (vEnd - v0) * (i / steps) + r * strength * decay);
    }
    upsertKey(keys, at + duration, vEnd);
  }
}

function valueAtKeys(keys: Key[], t: number, base: number): number {
  const tmp = { tracks: { v: keys } } as unknown as SceneObj;
  return keys.length ? valueAt(tmp, "v", t) : base;
}


function edgeDistance(x: number, b: { x: number; w: number }) {
  if (x < b.x) return b.x - x;
  if (x > b.x + b.w) return x - (b.x + b.w);
  return 0;
}

function boardColor(obj: SceneObj): string {
  if (obj.type !== "drawing") return "#ffffff";
  const filled = obj.parts.filter((p) => p.fill && p.fill !== "none" && (p.kind === "rect" || p.kind === "box3" || p.kind === "poly" || p.kind === "ellipse"));
  // The innermost big panel is usually the writing surface: the second filled rect if there's a frame.
  const areas = filled.map((p) => ({ p, a: p.kind === "rect" || p.kind === "box3" ? Math.abs(p.w * p.h) : 1 }));
  areas.sort((a, b) => b.a - a.a);
  return (areas[1] && areas[1].a > areas[0].a * 0.5 ? areas[1].p.fill : areas[0]?.p.fill) ?? "#ffffff";
}

function isDark(color: string): boolean {
  const m = color.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return /black|green|navy|dark|brown/i.test(color);
  let hex = m[1];
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  const n = parseInt(hex, 16);
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum < 130;
}

function hasKeysBetween(obj: StickmanObj, from: number, to: number) {
  return ["rShoulder", "lShoulder", "rElbow", "lElbow"].some((j) => obj.tracks[j]?.some((k) => k.t > from + 0.01 && k.t < to - 0.01));
}

function findAsset(assets: AssetInfo[], ref: string) {
  const lower = ref.toLowerCase();
  const asset = assets.find((a) => a.id === ref) ?? assets.find((a) => a.name.toLowerCase() === lower);
  if (!asset) throw new Error(`no imported picture called "${ref}"`);
  return asset;
}

const fmt = (t: number) => (Math.round(t * 10) / 10).toString();
const truncate = (s: string, n = 30) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
