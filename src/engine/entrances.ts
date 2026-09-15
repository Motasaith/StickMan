// How things arrive and leave: keyframes written onto an object's tracks, so they show on
// the timeline and can be edited like any other animation.

import type { SceneObj } from "./scene";
import { animateTrack, sampleKeys, upsertKey, removeKeys } from "./tracks";

export const ENTER_KINDS = ["fade", "pop", "slideUp", "slideDown", "slideLeft", "slideRight", "zoom", "drop", "spin", "typewriter", "drawOn", "grow"] as const;
export type EnterKind = (typeof ENTER_KINDS)[number];
export const EXIT_KINDS = ["fade", "pop", "slideUp", "slideDown", "slideLeft", "slideRight", "zoom", "spin"] as const;
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
  const fadeDur = kind === "typewriter" || kind === "drawOn" ? 0.01 : Math.min(dur, 0.35);
  const target = at(obj, "opacity", start + dur) || 1;
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
    case "fade":
      break;
  }
  animateTrack(obj.tracks, "opacity", obj.opacity, 0, start, dur, "easeInOut");
}
