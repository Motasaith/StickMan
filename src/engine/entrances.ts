// How things arrive and leave: keyframes written onto an object's tracks, so they show on
// the timeline and can be edited like any other animation.

import type { SceneObj } from "./scene";
import { animateTrack, sampleKeys, upsertKey, removeKeys } from "./tracks";

export const ENTER_KINDS = [
  "fade",
  "pop",
  "bounceIn",
  "stamp",
  "slideUp",
  "slideDown",
  "slideLeft",
  "slideRight",
  "rise",
  "elastic",
  "zoom",
  "grow",
  "drop",
  "spin",
  "roll",
  "swingIn",
  "glitchIn",
  "flicker",
  "typewriter",
  "drawOn",
] as const;
export type EnterKind = (typeof ENTER_KINDS)[number];
export const EXIT_KINDS = ["fade", "pop", "slideUp", "slideDown", "slideLeft", "slideRight", "zoom", "spin", "fall", "shrink", "flicker", "glitchOut"] as const;
export type ExitKind = (typeof EXIT_KINDS)[number];

function base(obj: SceneObj, prop: "x" | "y" | "scale" | "rotation" | "opacity"): number {
  return obj[prop];
}

/** The value a property has at time t (its keys, or its base value). */
function at(obj: SceneObj, prop: "x" | "y" | "scale" | "rotation" | "opacity", t: number): number {
  const keys = obj.tracks[prop];
  return keys?.length ? sampleKeys(keys, t) : base(obj, prop);
}

/** Hold `from` until `start`, then move to the value the property has at the end, over dur. */
function arrive(obj: SceneObj, prop: "x" | "y" | "scale" | "rotation" | "opacity", from: number, start: number, dur: number, e: "easeOut" | "easeInOut" = "easeOut") {
  const to = at(obj, prop, start + dur);
  const keys = (obj.tracks[prop] ??= []);
  removeKeys(keys, -1, start + dur);
  upsertKey(keys, 0, from);
  if (start > 0.001) upsertKey(keys, start, from);
  upsertKey(keys, start + dur, to, e);
}

/** Keys through a sequence of values after `start`, fractions of `dur`; the last value is the resting one. */
function sequence(obj: SceneObj, prop: "x" | "y" | "scale" | "rotation", steps: Array<[number, number]>, start: number, dur: number, relative: "add" | "mul") {
  const rest = at(obj, prop, start + dur);
  const keys = (obj.tracks[prop] ??= []);
  removeKeys(keys, -1, start + dur);
  const value = (v: number) => (relative === "add" ? rest + v : rest * v);
  upsertKey(keys, 0, value(steps[0][1]));
  if (start > 0.001) upsertKey(keys, start, value(steps[0][1]));
  for (const [f, v] of steps.slice(1)) upsertKey(keys, start + f * dur, value(v), "easeInOut");
  upsertKey(keys, start + dur, rest, "easeOut");
}

/** Write an entrance: before `start` the object is hidden, then it arrives over `dur` seconds. */
export function enter(obj: SceneObj, kind: EnterKind, start: number, dur = 0.6) {
  start = Math.max(0, start);
  dur = Math.max(0.05, dur);
  const pivoted = obj.type !== "stickman" && obj.type !== "creature";
  const size = "w" in obj && typeof obj.w === "number" ? Math.max(40, Math.min(obj.w, "h" in obj && typeof obj.h === "number" ? obj.h : obj.w)) : 60;
  switch (kind) {
    case "fade":
      break;
    case "pop":
      if (pivoted) obj.pivot = "center";
      arrive(obj, "scale", at(obj, "scale", start + dur) * 0.3, start, dur * 0.7, "easeOut");
      {
        const keys = obj.tracks.scale!;
        const to = keys[keys.length - 1].v;
        keys[keys.length - 1].v = to * 1.08;
        upsertKey(keys, start + dur, to, "easeInOut");
      }
      break;
    case "grow":
    case "zoom":
      if (pivoted) obj.pivot = "center";
      arrive(obj, "scale", at(obj, "scale", start + dur) * (kind === "zoom" ? 1.5 : 0.1), start, dur);
      break;
    case "slideUp":
    case "slideDown":
      arrive(obj, "y", at(obj, "y", start + dur) + (kind === "slideUp" ? 1 : -1) * Math.max(30, size * 0.25), start, dur);
      break;
    case "slideLeft":
    case "slideRight":
      arrive(obj, "x", at(obj, "x", start + dur) + (kind === "slideLeft" ? 1 : -1) * Math.max(60, size * 0.5), start, dur);
      break;
    case "drop": {
      const y = at(obj, "y", start + dur);
      const keys = (obj.tracks.y ??= []);
      removeKeys(keys, -1, start + dur);
      upsertKey(keys, 0, y - 260);
      if (start > 0.001) upsertKey(keys, start, y - 260);
      upsertKey(keys, start + dur * 0.6, y + 12, "easeIn");
      upsertKey(keys, start + dur * 0.8, y - 10, "easeOut");
      upsertKey(keys, start + dur, y, "easeIn");
      break;
    }
    case "spin":
      if (pivoted) obj.pivot = "center";
      arrive(obj, "rotation", at(obj, "rotation", start + dur) - 180, start, dur);
      arrive(obj, "scale", at(obj, "scale", start + dur) * 0.3, start, dur);
      break;
    case "bounceIn":
      if (pivoted) obj.pivot = "center";
      sequence(obj, "scale", [[0, 0.2], [0.45, 1.18], [0.65, 0.92], [0.82, 1.04]], start, dur, "mul");
      break;
    case "stamp":
      // Slams down from large, like a rubber stamp.
      if (pivoted) obj.pivot = "center";
      sequence(obj, "scale", [[0, 2.4], [0.55, 0.94], [0.75, 1.03]], start, dur, "mul");
      break;
    case "rise":
      sequence(obj, "y", [[0, Math.max(50, size * 0.4)], [0.7, -3]], start, Math.max(dur, 0.9), "add");
      break;
    case "elastic":
      sequence(obj, "x", [[0, -Math.max(90, size * 0.6)], [0.45, 22], [0.65, -10], [0.82, 4]], start, dur, "add");
      break;
    case "roll":
      if (pivoted) obj.pivot = "center";
      sequence(obj, "x", [[0, -Math.max(120, size)]], start, dur, "add");
      sequence(obj, "rotation", [[0, -360]], start, dur, "add");
      break;
    case "swingIn":
      if (pivoted) obj.pivot = "center";
      sequence(obj, "rotation", [[0, -35], [0.45, 12], [0.7, -5], [0.88, 2]], start, dur, "add");
      break;
    case "glitchIn": {
      // Jumps sideways a few times before settling.
      const x = at(obj, "x", start + dur);
      const keys = (obj.tracks.x ??= []);
      removeKeys(keys, -1, start + dur);
      upsertKey(keys, 0, x);
      const jitter = [14, -18, 9, -6, 3];
      jitter.forEach((j, k) => upsertKey(keys, start + ((k + 0.5) / jitter.length) * dur, x + j, "step"));
      upsertKey(keys, start + dur, x, "step");
      break;
    }
    case "flicker":
      break;
    case "typewriter":
    case "drawOn": {
      const keys = (obj.tracks.reveal ??= []);
      removeKeys(keys, -1, 1e9);
      const len = obj.type === "text" ? obj.text.length : 20;
      const d = kind === "typewriter" ? Math.max(dur, Math.min(3, len * 0.045)) : dur;
      keys.push({ t: 0, v: 0 }, { t: start, v: 0 }, { t: start + d, v: 1, e: "linear" });
      break;
    }
  }
  // Every entrance starts invisible and becomes visible as it arrives.
  const target = at(obj, "opacity", start + dur) || 1;
  if (kind === "flicker" || kind === "glitchIn") {
    const op = (obj.tracks.opacity ??= []);
    removeKeys(op, -1, start + dur);
    upsertKey(op, 0, 0);
    const blinks = [1, 0.1, 0.8, 0, 1, 0.4];
    blinks.forEach((v, k) => upsertKey(op, start + (k / blinks.length) * dur, v * target, "step"));
    upsertKey(op, start + dur, target, "step");
    return;
  }
  const fadeDur = kind === "typewriter" || kind === "drawOn" ? 0.01 : kind === "stamp" ? Math.min(dur, 0.12) : Math.min(dur, 0.35);
  const op = (obj.tracks.opacity ??= []);
  removeKeys(op, -1, start + fadeDur);
  upsertKey(op, 0, 0);
  if (start > 0.001) upsertKey(op, start, 0);
  upsertKey(op, start + fadeDur, target, kind === "typewriter" || kind === "drawOn" ? "step" : "easeOut");
}

/** Write an exit that ends at `end`: the object leaves over `dur` and stays hidden after. */
export function exit(obj: SceneObj, kind: ExitKind, end: number, dur = 0.5) {
  const start = Math.max(0, end - dur);
  const pivoted = obj.type !== "stickman" && obj.type !== "creature";
  const size = "w" in obj && typeof obj.w === "number" ? Math.max(40, obj.w) : 60;
  const leave = (prop: "x" | "y" | "scale" | "rotation", to: number) => animateTrack(obj.tracks, prop, base(obj, prop), to, start, dur, "easeInOut");
  switch (kind) {
    case "pop":
    case "zoom":
      if (pivoted) obj.pivot = "center";
      leave("scale", at(obj, "scale", start) * (kind === "zoom" ? 1.4 : 0.2));
      break;
    case "spin":
      if (pivoted) obj.pivot = "center";
      leave("rotation", at(obj, "rotation", start) + 180);
      leave("scale", at(obj, "scale", start) * 0.2);
      break;
    case "slideUp":
    case "slideDown":
      leave("y", at(obj, "y", start) + (kind === "slideDown" ? 1 : -1) * Math.max(40, size * 0.25));
      break;
    case "slideLeft":
    case "slideRight":
      leave("x", at(obj, "x", start) + (kind === "slideRight" ? 1 : -1) * Math.max(80, size * 0.5));
      break;
    case "fall":
      leave("y", at(obj, "y", start) + Math.max(160, size * 1.2));
      leave("rotation", at(obj, "rotation", start) + 12);
      break;
    case "shrink":
      if (pivoted) obj.pivot = "center";
      leave("scale", at(obj, "scale", start) * 0.05);
      break;
    case "flicker":
    case "glitchOut": {
      if (kind === "glitchOut") {
        const x = at(obj, "x", start);
        const keys = (obj.tracks.x ??= []);
        [12, -16, 8, -4].forEach((j, k) => upsertKey(keys, start + ((k + 0.5) / 4) * dur, x + j, "step"));
      }
      const op = (obj.tracks.opacity ??= []);
      const from = at(obj, "opacity", start);
      removeKeys(op, start, 1e9, true);
      upsertKey(op, start, from);
      [0.2, 0.9, 0, 0.6, 0].forEach((v, k) => upsertKey(op, start + ((k + 1) / 5) * dur, v * from, "step"));
      return;
    }
    case "fade":
      break;
  }
  animateTrack(obj.tracks, "opacity", obj.opacity, 0, start, dur, "easeInOut");
}
