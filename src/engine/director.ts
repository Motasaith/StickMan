// Camera direction for the 3D view: named shots, and an automatic director that plans
// an establishing shot, dialogue coverage, tracking during walks and a closing pull-back.

import type { Ease, Scene, SceneObj } from "./scene";
import { findObj } from "./scene";
import { objectBounds, worldState } from "./render";
import { animateTrack, camera3dBase, removeKeys, valueAt } from "./tracks";

export const SHOT_KINDS = ["wide", "medium", "closeup", "twoShot", "overShoulder", "low", "high", "topDown", "tracking", "orbit", "dollyIn", "craneUp"] as const;
export type ShotKind = (typeof SHOT_KINDS)[number];

const DEG = Math.PI / 180;
const FOV = 35;
/** Visible height at distance d with the default lens. */
const VIEW = 2 * Math.tan((FOV / 2) * DEG);

interface Subject {
  x: number;
  z: number;
  /** Height of the subject's top above the floor. */
  top: number;
  height: number;
  /** Heading in degrees in the floor plane (0 = +x, 90 = +z toward the camera). */
  heading: number;
}

function subject(scene: Scene, obj: SceneObj, t: number): Subject {
  const w = worldState(scene, obj, t);
  const b = objectBounds(undefined, scene, obj, t);
  const heading = valueAt(obj, "yaw", t) + (valueAt(obj, "facing", t) < 0 ? 180 : 0);
  const height = Math.max(40, b.h);
  return { x: w.x, z: valueAt(obj, "z", t), top: scene.ground - b.y, height, heading };
}

interface CameraKey {
  tx: number;
  ty: number;
  tz: number;
  dist: number;
  yaw: number;
  pitch: number;
}

/** Camera yaw that sees a subject's face from a three-quarter angle. */
function faceYaw(heading: number, side = 1): number {
  const fx = Math.cos(heading * DEG);
  const fz = Math.sin(heading * DEG);
  // Blend "in front of the face" with "toward the audience" so it never shoots from behind.
  const dx = fx * 0.75 + side * -fz * 0.15;
  const dz = fz * 0.75 + 0.85;
  return Math.atan2(dx, dz) / DEG;
}

function unwrap(from: number, to: number): number {
  let v = to;
  while (v - from > 180) v -= 360;
  while (v - from < -180) v += 360;
  return v;
}

function currentKey(scene: Scene, t: number): CameraKey {
  const tracks = scene.camera3d?.tracks ?? {};
  const get = (p: string) => (tracks[p]?.length ? valueAt({ tracks } as unknown as SceneObj, p, t) : camera3dBase(scene, p));
  return { tx: get("tx"), ty: get("ty"), tz: get("tz"), dist: get("dist"), yaw: get("yaw"), pitch: get("pitch") };
}

/** A solid prop's box on the floor plan: x and z ranges, and its height above the floor. */
export interface Box {
  x0: number;
  x1: number;
  y1: number;
  z0: number;
  z1: number;
}

/**
 * The floor-plan box of a drawing's solid parts at time t, or null if it has none.
 * With `grounded`, only parts that reach down near the floor count (a tree's trunk, not
 * its crown), which is what someone walking by would bump into.
 */
export function solidFootprint(scene: Scene, o: SceneObj, t: number, grounded = false): Box | null {
  if (o.type !== "drawing") return null;
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  let top = Infinity;
  for (const p of o.parts) {
    let px0: number, px1: number, pz0: number, pz1: number, py0: number, py1: number;
    if (p.kind === "box3" || p.kind === "prism3") {
      [px0, px1, pz0, pz1, py0, py1] = [p.x, p.x + p.w, (p.z ?? 0) - p.d / 2, (p.z ?? 0) + p.d / 2, p.y, p.y + p.h];
    } else if (p.kind === "sphere3") {
      [px0, px1, pz0, pz1, py0, py1] = [p.cx - p.r, p.cx + p.r, (p.cz ?? 0) - p.r, (p.cz ?? 0) + p.r, p.cy - p.r, p.cy + p.r];
    } else if (p.kind === "cylinder3" || p.kind === "cone3") {
      [px0, px1, pz0, pz1, py0, py1] = [p.cx - p.r, p.cx + p.r, (p.z ?? 0) - p.r, (p.z ?? 0) + p.r, p.y, p.y + p.h];
    } else continue;
    if (grounded && py1 < -100) continue;
    x0 = Math.min(x0, px0);
    x1 = Math.max(x1, px1);
    z0 = Math.min(z0, pz0);
    z1 = Math.max(z1, pz1);
    top = Math.min(top, py0);
  }
  if (x0 === Infinity) return null;
  const w = worldState(scene, o, t);
  const k = w.scale;
  const oz = valueAt(o, "z", t);
  let hx = ((x1 - x0) * k) / 2;
  let hz = ((z1 - z0) * k) / 2;
  const cx = w.x + ((x0 + x1) / 2) * k;
  const cz = oz + ((z0 + z1) / 2) * k;
  // A turned prop: use a footprint that covers it at any angle.
  if (Math.abs(valueAt(o, "yaw", t)) > 5) hx = hz = Math.max(hx, hz);
  return { x0: cx - hx, x1: cx + hx, y1: scene.ground - (w.y + top * k), z0: cz - hz, z1: cz + hz };
}

/** Floor-plan boxes of the solid props (and, unless told not to, the actors) that could block the camera's view at time t. */
function obstacles(scene: Scene, t: number, actors: boolean): Box[] {
  const out: Box[] = [];
  if (actors) {
    for (const o of scene.objects) {
      if ((o.type !== "stickman" && o.type !== "creature") || valueAt(o, "opacity", t) < 0.3) continue;
      const w = worldState(scene, o, t);
      const z = valueAt(o, "z", t);
      const b = objectBounds(undefined, scene, o, t);
      const r = 22 * w.scale;
      out.push({ x0: w.x - r, x1: w.x + r, y1: scene.ground - b.y, z0: z - r, z1: z + r });
    }
  }
  for (const o of scene.objects) {
    if (o.type !== "drawing" || valueAt(o, "opacity", t) < 0.3) continue;
    const box = solidFootprint(scene, o, t);
    // Roads, rugs and ponds lie flat: the camera sees over them.
    if (box && box.y1 >= 70) out.push(box);
  }
  return out;
}

/** Whether the camera at this key sees its target without a prop in the way. */
function clearView(key: CameraKey, boxes: Box[]): boolean {
  const yaw = key.yaw * DEG;
  const pitch = key.pitch * DEG;
  const cam = { x: key.tx + Math.sin(yaw) * Math.cos(pitch) * key.dist, y: key.ty + Math.sin(pitch) * key.dist, z: key.tz + Math.cos(yaw) * Math.cos(pitch) * key.dist };
  // A prop the target stands inside never counts (someone in a tent or behind a wide counter).
  const near = (b: Box) => key.tx > b.x0 && key.tx < b.x1 && key.tz > b.z0 && key.tz < b.z1;
  const blocking = boxes.filter((b) => !near(b));
  if (!blocking.length) return true;
  for (const ty of [key.ty, key.ty * 0.55]) {
    for (let i = 0; i <= 20; i++) {
      const f = (i / 20) * 0.9;
      const x = cam.x + (key.tx - cam.x) * f;
      const y = cam.y + (ty - cam.y) * f;
      const z = cam.z + (key.tz - cam.z) * f;
      if (y < 0) continue;
      if (blocking.some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y < b.y1)) return false;
    }
  }
  return true;
}

/** Nudge a camera key around props that would block the view: turn a little, then move in, then rise. */
function avoidObstacles(scene: Scene, key: CameraKey, t: number, actors: boolean): CameraKey {
  const boxes = obstacles(scene, t, actors);
  if (!boxes.length || clearView(key, boxes)) return key;
  for (const turn of [20, -20, 40, -40, 60, -60]) {
    const k = { ...key, yaw: key.yaw + turn };
    if (clearView(k, boxes)) return k;
  }
  for (const f of [0.75, 0.55, 0.4]) {
    for (const turn of [0, 25, -25]) {
      const k = { ...key, dist: key.dist * f, yaw: key.yaw + turn };
      if (clearView(k, boxes)) return k;
    }
  }
  for (const pitch of [30, 45, 60]) {
    const k = { ...key, pitch: Math.max(key.pitch, pitch) };
    if (clearView(k, boxes)) return k;
  }
  return key;
}

function moveTo(scene: Scene, key: CameraKey, at: number, dur: number, e: Ease = "easeInOut", actors = true) {
  const tracks = (scene.camera3d ??= { tracks: {} }).tracks;
  const cur = currentKey(scene, at);
  key = avoidObstacles(scene, key, at + Math.max(0, dur), actors);
  const target = { ...key, yaw: unwrap(cur.yaw, key.yaw) };
  for (const prop of ["tx", "ty", "tz", "dist", "yaw", "pitch"] as const) {
    animateTrack(tracks, prop, camera3dBase(scene, prop), Math.round(target[prop] * 10) / 10, at, Math.max(0, dur), e);
  }
}

function groupFrame(scene: Scene, ids: SceneObj[], t: number) {
  const subs = ids.map((o) => subject(scene, o, t));
  if (!subs.length) return null;
  const minX = Math.min(...subs.map((s) => s.x - 80));
  const maxX = Math.max(...subs.map((s) => s.x + 80));
  const minZ = Math.min(...subs.map((s) => s.z));
  const maxZ = Math.max(...subs.map((s) => s.z));
  const tall = Math.max(...subs.map((s) => s.top));
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, width: maxX - minX, depth: maxZ - minZ, tall };
}

/** Frame one named shot, moving there over `ease` seconds then holding (or moving) until `at + duration`. */
export function planShot(scene: Scene, kind: ShotKind, at: number, duration: number, targetId?: string, target2Id?: string): string {
  const actors = scene.objects.filter((o) => o.type === "stickman" || o.type === "creature");
  const main = targetId ? findObj(scene, targetId) : actors[0];
  const other = target2Id ? findObj(scene, target2Id) : undefined;
  if (targetId && !main) throw new Error(`no object with id "${targetId}"`);
  if (target2Id && !other) throw new Error(`no object with id "${target2Id}"`);
  const aspect = scene.width / scene.height;
  const blend = Math.min(0.8, duration * 0.35);
  const end = at + duration;
  const s = main ? subject(scene, main, at) : null;

  const wideKey = (t: number): CameraKey => {
    const g = groupFrame(scene, actors.length ? actors : [], t);
    if (!g) return { ...currentKey(scene, t), yaw: -20, pitch: 18 };
    const dist = Math.max((g.width * 1.3) / (VIEW * aspect), (g.tall * 1.6) / VIEW, 900) + g.depth * 0.5;
    return { tx: g.cx, ty: g.tall * 0.45, tz: g.cz, dist, yaw: -22, pitch: 18 };
  };

  switch (kind) {
    case "wide":
      moveTo(scene, wideKey(at), at, blend);
      moveTo(scene, { ...wideKey(end), yaw: -14, dist: wideKey(end).dist * 0.94 }, at + blend, duration - blend, "linear");
      break;
    case "medium":
    case "closeup":
    case "low":
    case "high": {
      if (!s) throw new Error("this shot needs a target");
      const close = kind === "closeup";
      const dist = close ? (s.height * 0.62) / VIEW : (s.height * 1.55) / VIEW;
      const ty = close ? s.top - s.height * 0.12 : s.top * 0.55;
      const pitch = kind === "low" ? -8 : kind === "high" ? 38 : close ? 4 : 9;
      const key = { tx: s.x, ty: kind === "low" ? s.top * 0.6 : ty, tz: s.z, dist: kind === "low" ? dist * 0.9 : dist, yaw: faceYaw(s.heading), pitch };
      moveTo(scene, key, at, blend);
      // A slow push in keeps the shot alive.
      moveTo(scene, { ...key, dist: key.dist * 0.9 }, at + blend, duration - blend, "linear");
      break;
    }
    case "twoShot": {
      if (!s) throw new Error("a two-shot needs a target");
      const o = other ?? actors.filter((a) => a.id !== main!.id).sort((p, q) => Math.abs(subject(scene, p, at).x - s.x) - Math.abs(subject(scene, q, at).x - s.x))[0];
      if (!o) return planShot(scene, "medium", at, duration, targetId);
      const b = subject(scene, o, at);
      const lx = b.x - s.x;
      const lz = b.z - s.z;
      let nx = -lz;
      let nz = lx;
      if (nz < 0) {
        nx = -nx;
        nz = -nz;
      }
      const span = Math.hypot(lx, lz);
      const dist = Math.max(((span + 260) * 1.2) / (VIEW * aspect), (Math.max(s.height, b.height) * 1.6) / VIEW);
      const key = { tx: (s.x + b.x) / 2, ty: Math.max(s.top, b.top) * 0.55, tz: (s.z + b.z) / 2, dist, yaw: Math.atan2(nx, nz) / DEG - 12, pitch: 10 };
      moveTo(scene, key, at, blend);
      moveTo(scene, { ...key, yaw: key.yaw + 8 }, at + blend, duration - blend, "linear");
      break;
    }
    case "overShoulder": {
      if (!s) throw new Error("an over-the-shoulder shot needs a target");
      const o = other ?? actors.find((a) => a.id !== main!.id);
      if (!o) return planShot(scene, "closeup", at, duration, targetId);
      const b = subject(scene, o, at);
      // Look at the target over the other one's shoulder.
      const dx = b.x - s.x;
      const dz = b.z - s.z;
      const yaw = Math.atan2(dx, dz) / DEG + 18;
      const key = { tx: s.x, ty: s.top - s.height * 0.2, tz: s.z, dist: Math.hypot(dx, dz) + 190, yaw, pitch: 6 };
      // The shoulder in the foreground is the point of this shot.
      moveTo(scene, key, at, blend, "easeInOut", false);
      break;
    }
    case "topDown": {
      const g = groupFrame(scene, s && main ? [main] : actors, at);
      if (!g) break;
      moveTo(scene, { tx: g.cx, ty: 0, tz: g.cz, dist: Math.max(900, g.width * 1.4), yaw: 0, pitch: 78 }, at, blend);
      break;
    }
    case "tracking": {
      if (!main) throw new Error("a tracking shot needs a target");
      const steps = Math.max(2, Math.ceil(duration / 0.5));
      for (let i = 0; i <= steps; i++) {
        const t = at + (duration * i) / steps;
        const sub = subject(scene, main, t);
        const moveYaw = faceYaw(sub.heading);
        const key = { tx: sub.x, ty: sub.top * 0.55, tz: sub.z, dist: (sub.height * 2.4) / VIEW, yaw: moveYaw * 0.4, pitch: 12 };
        if (i === 0) moveTo(scene, key, at, blend);
        else moveTo(scene, key, at + (duration * (i - 1)) / steps + (i === 1 ? blend : 0), duration / steps - (i === 1 ? blend : 0), "linear");
      }
      break;
    }
    case "orbit": {
      const base = s ? { tx: s.x, ty: s.top * 0.5, tz: s.z, dist: (s.height * 2.6) / VIEW, pitch: 16 } : wideKey(at);
      const startYaw = currentKey(scene, at).yaw;
      moveTo(scene, { ...base, yaw: startYaw }, at, blend);
      moveTo(scene, { ...base, yaw: startYaw + Math.min(360, 60 * duration) }, at + blend, duration - blend, "linear");
      break;
    }
    case "dollyIn": {
      const g = s ?? subject(scene, actors[0] ?? scene.objects[0], at);
      const far = { tx: g.x, ty: g.top * 0.55, tz: g.z, dist: (g.height * 4) / VIEW, yaw: faceYaw(g.heading), pitch: 12 };
      moveTo(scene, far, at, blend);
      moveTo(scene, { ...far, dist: (g.height * 1.3) / VIEW, ty: g.top * 0.75, pitch: 6 }, at + blend, duration - blend, "easeInOut");
      break;
    }
    case "craneUp": {
      const g = s ? { cx: s.x, cz: s.z, tall: s.top, width: 300 } : groupFrame(scene, actors, at);
      if (!g) break;
      const low = { tx: g.cx, ty: g.tall * 0.4, tz: g.cz, dist: Math.max(700, g.width * 1.5), yaw: -10, pitch: 2 };
      moveTo(scene, low, at, blend);
      moveTo(scene, { ...low, dist: low.dist * 1.6, pitch: 42, yaw: 10 }, at + blend, duration - blend, "easeInOut");
      break;
    }
  }
  return `${kind} shot${targetId ? ` on ${targetId}` : ""} (${at.toFixed(1)}s to ${end.toFixed(1)}s)`;
}

interface Line {
  speaker: string;
  start: number;
  end: number;
}

/**
 * Plan the scene's camera like a director. Replaces the 3D camera animation from `from`
 * seconds on (the whole film by default), keeping the shots before it.
 */
export function directScene(scene: Scene, from = 0): string {
  const tracks = (scene.camera3d ??= { tracks: {} }).tracks;
  from = Math.max(0, Math.min(from, scene.duration));
  if (from <= 0.05) {
    from = 0;
    for (const k of Object.keys(tracks)) delete tracks[k];
  } else {
    for (const keys of Object.values(tracks)) if (keys) removeKeys(keys, from, 1e9);
  }

  const actors = scene.objects.filter((o) => (o.type === "stickman" || o.type === "creature") && valueAt(o, "opacity", scene.duration / 2) > 0.05);
  const D = scene.duration;
  if (!actors.length) {
    planShot(scene, "wide", 0, D);
    return "planned a slow establishing camera";
  }

  const lines: Line[] = scene.objects
    .filter((o): o is Extract<SceneObj, { type: "bubble" }> => o.type === "bubble" && !!o.target && !o.thought)
    .map((b) => {
      const keys = b.tracks.opacity ?? [];
      const start = b.audio?.at ?? keys.find((k) => k.v > 0.5)?.t ?? 0;
      const end = b.audio ? b.audio.at + b.audio.duration : keys.find((k) => k.t > start && k.v < 0.5)?.t ?? start + 2;
      return { speaker: b.target!, start, end: Math.min(D, end) };
    })
    .sort((a, b) => a.start - b.start);

  const shots: string[] = [];
  let t = from;
  if (from === 0) {
    const firstEvent = Math.min(lines[0]?.start ?? D, D);
    const opening = Math.max(1.5, Math.min(3.5, firstEvent || 3));
    planShot(scene, "wide", 0, Math.min(opening, D));
    shots.push("establishing wide");
    t = Math.min(opening, D);
  }

  const moving = (o: SceneObj, a: number, b: number) => Math.hypot(valueAt(o, "x", b) - valueAt(o, "x", a), valueAt(o, "z", b) - valueAt(o, "z", a)) > 150;
  const fillGap = (from: number, to: number) => {
    if (to - from < 1.2) return;
    const walker = actors.find((o) => moving(o, from, to));
    if (walker) {
      planShot(scene, "tracking", from, to - from, walker.id);
      shots.push(`tracking ${walker.id}`);
    } else {
      planShot(scene, to - from > 4 ? "orbit" : "wide", from, to - from, actors.length === 1 ? actors[0].id : undefined);
      shots.push(to - from > 4 ? "slow orbit" : "wide");
    }
  };

  let lastSpeaker = lines.filter((l) => l.start < from).pop()?.speaker ?? "";
  for (const line of lines) {
    if (line.end <= t) continue;
    const start = Math.max(t, line.start - 0.3);
    fillGap(t, start);
    const len = line.end - start;
    const listener = actors.find((a) => a.id !== line.speaker && Math.abs(valueAt(a, "x", start) - valueAt(findObj(scene, line.speaker) ?? a, "x", start)) < 700);
    if (listener && lastSpeaker !== line.speaker && lastSpeaker !== "" && len > 2.4) {
      planShot(scene, "overShoulder", start, len, line.speaker, listener.id);
      shots.push(`over the shoulder on ${line.speaker}`);
    } else if (listener && lastSpeaker === "") {
      planShot(scene, "twoShot", start, len, line.speaker, listener.id);
      shots.push(`two-shot ${line.speaker} and ${listener.id}`);
    } else {
      planShot(scene, len < 1.8 ? "closeup" : "medium", start, len, line.speaker);
      shots.push(`${len < 1.8 ? "close-up" : "medium"} on ${line.speaker}`);
    }
    lastSpeaker = line.speaker;
    t = line.end;
  }

  const closing = Math.min(2, D - t);
  fillGap(t, D - closing);
  if (closing > 0.5) {
    planShot(scene, "craneUp", D - closing, closing);
    shots.push("closing crane up");
  }
  return `directed the camera${from ? ` from ${from.toFixed(1)}s` : ""}: ${shots.join(", ")}`;
}
