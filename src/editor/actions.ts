// Editing actions shared by the keyboard, the timeline toolbar and the panels.

import { toast } from "sonner";
import { useStore } from "@/store";
import { cloneScene, findObj, uniqueId, type SceneObj } from "@/engine/scene";
import { videoSourceTime } from "@/engine/media";
import { keyTimes } from "@/engine/tracks";

/** Split the selected video or audio clip (or every clip under the playhead) at the playhead. */
export function splitAtPlayhead() {
  const s = useStore.getState();
  const t = Math.round(s.time * 1000) / 1000;
  const sel = s.selectedId ? findObj(s.scene, s.selectedId) : undefined;
  const targets = sel && (sel.type === "video" || sel.type === "audio") ? [sel] : s.scene.objects.filter((o) => (o.type === "video" && videoSourceTime(o, t) !== null) || (o.type === "audio" && t > o.start && t < o.start + o.duration));
  const ops = targets.filter((o) => (o.type === "video" || o.type === "audio") && t > o.start + 0.05 && t < o.start + o.duration - 0.05).map((o) => ({ op: "split", id: o.id, at: t }));
  if (!ops.length) {
    toast.message("Nothing to split here", { description: "Put the playhead over a video or sound clip." });
    return;
  }
  s.run(ops);
}

export function duplicateObject(id: string) {
  const s = useStore.getState();
  const obj = findObj(s.scene, id);
  if (!obj) return;
  const next = cloneScene(s.scene);
  const copy = structuredClone(obj) as SceneObj;
  copy.id = uniqueId(next, obj.id);
  copy.name = `${obj.name} copy`;
  if (copy.type !== "audio" && copy.type !== "caption" && copy.type !== "sound") {
    copy.x += 30;
    copy.y += 30;
    for (const k of copy.tracks.x ?? []) k.v += 30;
    for (const k of copy.tracks.y ?? []) k.v += 30;
  }
  next.objects.splice(next.objects.indexOf(findObj(next, id)!) + 1, 0, copy);
  s.commit(next);
  s.select(copy.id);
}

/** When an object is on screen: [first, last] second, for the timeline bar. */
export function objectSpan(o: SceneObj, duration: number): [number, number] {
  switch (o.type) {
    case "video":
      return [o.start, o.start + o.duration + (o.freeze ?? 0)];
    case "audio":
      return [o.start, o.start + o.duration];
    case "sound":
      return [o.at, o.at + Math.max(0.3, o.duration)];
    case "caption":
      return o.words.length ? [o.words[0].start, o.words[o.words.length - 1].end + 0.4] : [0, duration];
    case "bubble":
      if (o.audio) return [o.audio.at, o.audio.at + o.audio.duration + 0.35];
  }
  const op = o.tracks.opacity;
  let start = 0;
  let end = duration;
  if (op?.length) {
    const first = op.find((k) => k.v > 0.01);
    start = first ? (op.indexOf(first) > 0 && op[op.indexOf(first) - 1].v <= 0.01 && first.e !== "step" ? op[op.indexOf(first) - 1].t : first.t) : 0;
    const lastVisible = [...op].reverse().find((k) => k.v > 0.01);
    const afterIdx = lastVisible ? op.indexOf(lastVisible) + 1 : -1;
    if (afterIdx > 0 && afterIdx < op.length && op[afterIdx].v <= 0.01) end = op[afterIdx].t;
    if (o.opacity <= 0.01 && !first) return [0, 0];
  }
  if (o.slide) {
    const sl = useStore.getState().scene.slides?.find((x) => x.id === o.slide);
    if (sl) {
      start = Math.max(start, sl.start);
      end = Math.min(end, sl.start + sl.duration + (sl.transition.duration || 0));
    }
  }
  return [Math.max(0, start), Math.max(start + 0.05, end)];
}

/** Move an object in time: its keys, clips, clocks and words shift together. */
export function shiftObject(o: SceneObj, dt: number) {
  for (const keys of Object.values(o.tracks)) for (const k of keys) if (k.t > 0 || dt > 0) k.t = Math.max(0, k.t + dt);
  if (o.links) for (const l of o.links) if (l.t > 0) l.t = Math.max(0, l.t + dt);
  if (o.type === "video" || o.type === "audio") o.start = Math.max(0, o.start + dt);
  if (o.type === "audio" && o.words) for (const w of o.words) (w.start += dt), (w.end += dt);
  if (o.type === "caption") for (const w of o.words) (w.start += dt), (w.end += dt);
  if (o.type === "svg") o.clock = Math.max(0, o.clock + dt);
  if (o.type === "chart") o.start = Math.max(0, o.start + dt);
  if (o.type === "text" && o.counter) o.counter.start = Math.max(0, o.counter.start + dt);
  if (o.type === "sound") o.at = Math.max(0, o.at + dt);
  if (o.type === "bubble" && o.audio) o.audio.at = Math.max(0, o.audio.at + dt);
  // An object that was visible from the start gets a hidden lead-in when moved later.
  if (dt > 0 && !o.tracks.opacity?.length && o.type !== "video" && o.type !== "audio" && o.type !== "sound" && o.type !== "caption") {
    o.tracks.opacity = [
      { t: 0, v: 0 },
      { t: dt, v: 1, e: "step" },
    ];
  }
}

export function hasAnimation(o: SceneObj) {
  return keyTimes(o.tracks).length > 1;
}
