import type { Ease, Key, Scene, SceneObj, Tracks } from "./scene";
import { EXPRESSIONS, JOINTS } from "./scene";

const EPS = 1e-4;

export function ease(e: Ease | undefined, u: number): number {
  switch (e) {
    case "step":
      return u >= 1 ? 1 : 0;
    case "easeIn":
      return u * u;
    case "easeOut":
      return 1 - (1 - u) * (1 - u);
    case "easeInOut":
      return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    default:
      return u;
  }
}

/** Keys must be sorted by time. Before the first key and after the last, the value holds. */
export function sampleKeys(keys: Key[], t: number): number {
  const n = keys.length;
  if (t <= keys[0].t) return keys[0].v;
  if (t >= keys[n - 1].t) return keys[n - 1].v;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (keys[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = keys[lo];
  const b = keys[hi];
  const span = b.t - a.t;
  const u = span <= EPS ? 1 : (t - a.t) / span;
  return a.v + (b.v - a.v) * ease(b.e, u);
}

export function baseValue(obj: SceneObj, prop: string): number {
  switch (prop) {
    case "x":
    case "y":
    case "rotation":
    case "scale":
    case "opacity":
      return obj[prop];
    case "reveal":
    case "squash":
      return 1;
    case "rootY":
    case "mouth":
    case "z":
    case "yaw":
      return 0;
    case "eyes":
      return 1;
  }
  if (prop.startsWith("b.")) return 0;
  if (obj.type === "creature" && prop === "facing") return obj.facing;
  if (obj.type === "stickman") {
    if (prop === "facing") return obj.facing;
    if (prop === "expr") return Math.max(0, EXPRESSIONS.indexOf(obj.expression));
    if ((JOINTS as readonly string[]).includes(prop)) return obj.pose[prop as keyof typeof obj.pose];
  }
  return 0;
}

export function valueAt(obj: SceneObj, prop: string, t: number): number {
  const keys = obj.tracks[prop];
  return keys && keys.length ? sampleKeys(keys, t) : baseValue(obj, prop);
}

export function cameraBase(scene: Scene, prop: string): number {
  if (prop === "zoom") return 1;
  if (prop === "x") return scene.width / 2;
  if (prop === "y") return scene.height / 2;
  return 0;
}

export const CAMERA3D_PROPS = ["yaw", "pitch", "dist", "tx", "ty", "tz", "fov"] as const;

/** Default 3D camera: looking at the middle of the stage from the front, a little above. */
export function camera3dBase(scene: Scene, prop: string): number {
  const fov = 35;
  switch (prop) {
    case "yaw":
      return 0;
    case "pitch":
      return 10;
    case "fov":
      return fov;
    case "tx":
      return scene.width / 2;
    case "ty":
      return (scene.ground - scene.height * 0.45) > 0 ? scene.ground - scene.height * 0.45 : scene.height * 0.4;
    case "tz":
      return 0;
    case "dist": {
      const aspect = scene.width / scene.height;
      return (scene.width * 0.55) / (Math.tan(((fov / 2) * Math.PI) / 180) * aspect);
    }
  }
  return 0;
}

export function camera3dAt(scene: Scene, t: number) {
  const tracks = scene.camera3d?.tracks ?? {};
  const get = (p: string) => {
    const keys = tracks[p];
    return keys && keys.length ? sampleKeys(keys, t) : camera3dBase(scene, p);
  };
  return { yaw: get("yaw"), pitch: get("pitch"), dist: Math.max(50, get("dist")), tx: get("tx"), ty: get("ty"), tz: get("tz"), fov: Math.max(10, Math.min(100, get("fov"))) };
}

export function cameraAt(scene: Scene, t: number) {
  const get = (p: string) => {
    const keys = scene.camera.tracks[p];
    return keys && keys.length ? sampleKeys(keys, t) : cameraBase(scene, p);
  };
  return { zoom: Math.max(0.05, get("zoom")), x: get("x"), y: get("y") };
}

/** Insert or replace the key at time t. */
export function upsertKey(keys: Key[], t: number, v: number, e?: Ease): void {
  const i = keys.findIndex((k) => Math.abs(k.t - t) < EPS);
  const key: Key = e && e !== "linear" ? { t, v, e } : { t, v };
  if (i >= 0) keys[i] = key;
  else {
    keys.push(key);
    keys.sort((a, b) => a.t - b.t);
  }
}

/** Remove keys with from < t <= to (from itself is kept unless inclusive). */
export function removeKeys(keys: Key[], from: number, to: number, inclusive = false): void {
  for (let i = keys.length - 1; i >= 0; i--) {
    const t = keys[i].t;
    const afterFrom = inclusive ? t >= from - EPS : t > from + EPS;
    if (afterFrom && t <= to + EPS) keys.splice(i, 1);
  }
}

/**
 * Animate a property from whatever it is at `start` to `to`, arriving at start+dur.
 * Later keys that fall inside the new segment are replaced; the value holds before and after.
 */
export function animateTrack(
  tracks: Tracks,
  prop: string,
  base: number,
  to: number,
  start: number,
  dur: number,
  e: Ease = "easeInOut"
): void {
  const keys = tracks[prop] ?? (tracks[prop] = []);
  const from = keys.length ? sampleKeys(keys, start) : base;
  if (!keys.length && start > EPS) keys.push({ t: 0, v: base });
  if (dur <= EPS) {
    removeKeys(keys, start, start, true);
    // Hold the old value right up to the jump.
    if (start > EPS && Math.abs(from - to) > EPS) upsertKey(keys, Math.max(0, start - 0.001), from);
    upsertKey(keys, start, to, "step");
    return;
  }
  removeKeys(keys, start, start + dur);
  if (!keys.some((k) => Math.abs(k.t - start) < EPS)) upsertKey(keys, start, from);
  upsertKey(keys, start + dur, to, e);
}

/** Set a property at one moment: the base value if it has no animation, otherwise a key at t. */
export function setAt(obj: SceneObj, prop: string, t: number, v: number): void {
  const keys = obj.tracks[prop];
  if (keys && keys.length) {
    upsertKey(keys, t, v);
    return;
  }
  setBase(obj, prop, v);
}

export function setBase(obj: SceneObj, prop: string, v: number): void {
  switch (prop) {
    case "x":
    case "y":
    case "rotation":
    case "scale":
    case "opacity":
      obj[prop] = v;
      return;
  }
  // Props with no stored base (bones, squash…) hold a single key instead.
  if (prop.startsWith("b.") || ["rootY", "mouth", "eyes", "squash", "reveal", "z", "yaw"].includes(prop)) {
    obj.tracks[prop] = [{ t: 0, v }];
    return;
  }
  if (obj.type === "creature" && prop === "facing") obj.facing = v < 0 ? -1 : 1;
  if (obj.type === "stickman") {
    if (prop === "facing") obj.facing = v < 0 ? -1 : 1;
    else if (prop === "expr") obj.expression = EXPRESSIONS[Math.round(v)] ?? "none";
    else if ((JOINTS as readonly string[]).includes(prop)) obj.pose[prop as keyof typeof obj.pose] = v;
  }
}

/** Every distinct key time of an object, sorted. */
export function keyTimes(tracks: Tracks): number[] {
  const set = new Set<number>();
  for (const keys of Object.values(tracks)) for (const k of keys) set.add(Math.round(k.t * 1000) / 1000);
  return [...set].sort((a, b) => a - b);
}

export function lastKeyTime(tracks: Tracks): number {
  let max = 0;
  for (const keys of Object.values(tracks)) for (const k of keys) max = Math.max(max, k.t);
  return max;
}

/** Move every key at time `from` to time `to`. */
export function moveKeysAt(tracks: Tracks, from: number, to: number): void {
  for (const keys of Object.values(tracks)) {
    for (const k of keys) if (Math.abs(k.t - from) < 0.0015) k.t = Math.max(0, to);
    keys.sort((a, b) => a.t - b.t);
  }
}

export function deleteKeysAt(tracks: Tracks, at: number): void {
  for (const [prop, keys] of Object.entries(tracks)) {
    const left = keys.filter((k) => Math.abs(k.t - at) >= 0.0015);
    if (left.length) tracks[prop] = left;
    else delete tracks[prop];
  }
}
