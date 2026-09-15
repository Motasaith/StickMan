// Measurable mistakes, found by code instead of by looking: things sinking into
// the floor, sitting on air, text spilling off a board, writing far from any board.
// The server sends these back to the AI once so it can fix its own plan.

import type { Op } from "./ops";
import type { Rect } from "./render";
import { solidFootprint } from "./director";
import { activeLink, objectBounds, stickmanPoints, stickmanTransform, worldState } from "./render";
import type { DrawingObj, Scene, StickmanObj } from "./scene";
import { findObj } from "./scene";
import { valueAt } from "./tracks";

const contains = (r: Rect, x: number, y: number, pad = 0) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
const intersects = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function firstVisibleTime(obj: { tracks: Scene["objects"][number]["tracks"] }): number {
  const keys = obj.tracks.opacity;
  if (!keys?.length) return 0;
  return keys.find((k) => k.v > 0.05)?.t ?? 0;
}

export function lintScene(scene: Scene, applied: Op[] = []): string[] {
  const out: string[] = [];
  const g = scene.ground;
  const cameraMoves = Object.keys(scene.camera.tracks).length > 0;
  const drawings = scene.objects.filter((o): o is DrawingObj => o.type === "drawing");

  for (const obj of scene.objects) {
    if (obj.type === "bubble") continue;
    const t = firstVisibleTime(obj);
    const b = objectBounds(undefined, scene, obj, t);
    const bottom = b.y + b.h;

    if (obj.type === "drawing" && b.h < scene.height * 0.6 && b.w < scene.width * 0.8 && bottom > g + 8 && b.y < g - 10 && !Object.keys(obj.tracks).some((k) => k === "y")) {
      out.push(`"${obj.id}" reaches down to y=${Math.round(bottom)} but the ground is y=${g}: it sinks into the floor. Move it up by ${Math.round(bottom - g)} so its lowest point is at y=${g}.`);
    }
    if (!cameraMoves && (b.x < -30 || b.y < -30 || b.x + b.w > scene.width + 30 || bottom > scene.height + 30) && b.w < scene.width * 1.5) {
      out.push(`"${obj.id}" is partly outside the ${scene.width}x${scene.height} canvas (box x${Math.round(b.x)} y${Math.round(b.y)} w${Math.round(b.w)} h${Math.round(b.h)}).`);
    }
    if (obj.type === "text") {
      for (const d of drawings) {
        const db = objectBounds(undefined, scene, d, t);
        const inside = b.x >= db.x - 4 && b.y >= db.y - 4 && b.x + b.w <= db.x + db.w + 4 && bottom <= db.y + db.h + 4;
        if (intersects(b, db) && !inside && b.w * b.h < db.w * db.h) {
          out.push(`text "${obj.id}" spills outside "${d.id}" (text box x${Math.round(b.x)} y${Math.round(b.y)} w${Math.round(b.w)} h${Math.round(b.h)}; ${d.id} box x${Math.round(db.x)} y${Math.round(db.y)} w${Math.round(db.w)} h${Math.round(db.h)}). Make it smaller or move it inside, or use the write op which fits text automatically.`);
          break;
        }
      }
    }
  }

  // In 3D, flat drawings look like cardboard cutouts. Real objects should be props or solids.
  if (scene.mode === "3d") {
    const drawn = new Set(applied.filter((o) => o.op === "draw").map((o) => (o as { id: string }).id));
    for (const obj of drawings) {
      if (!drawn.has(obj.id)) continue;
      const solid = obj.parts.some((p) => p.kind === "box3" || p.kind === "prism3" || p.kind === "sphere3" || p.kind === "cylinder3" || p.kind === "cone3");
      const b = objectBounds(undefined, scene, obj, firstVisibleTime(obj));
      const backdrop = b.w >= scene.width * 0.7 || b.h >= scene.height * 0.7;
      const onFloor = b.y >= g - 6;
      if (!solid && !backdrop && !onFloor && b.h > 60) {
        out.push(`"${obj.id}" is drawn with flat 2D parts, so in 3D it looks like a paper cutout. Use {"op":"prop","kind":...} (house, tree, table, car, ...) or build it from box3/prism3/cylinder3/cone3/sphere3 parts.`);
      }
    }
  }

  // Things that should stand on the floor but hang in the air (common when y is taken as "height").
  for (const obj of scene.objects) {
    const standing =
      obj.type === "stickman" ||
      (obj.type === "creature" && (obj.species === "dog" || obj.species === "cat")) ||
      (obj.type === "drawing" && obj.parts.some((p) => p.kind === "box3" || p.kind === "cylinder3" || p.kind === "cone3"));
    if (!standing || obj.tracks.y?.length || activeLink(obj, 0)) continue;
    const t = firstVisibleTime(obj);
    const b = objectBounds(undefined, scene, obj, t);
    const bottom = b.y + b.h;
    if (bottom < g - 60) {
      out.push(`"${obj.id}" floats ${Math.round(g - bottom)} above the floor (its bottom is y=${Math.round(bottom)}, the floor is y=${g}; y grows DOWNWARD). Put things that stand on the floor at y=${g}, with parts going up in negative y.`);
    }
  }

  // In 3D, a character whose feet are inside a solid prop's floor plan is inside it, not in front of it.
  if (scene.mode === "3d") {
    for (const who of scene.objects.filter((o) => o.type === "stickman" || o.type === "creature")) {
      for (const prop of drawings) {
        for (let t = 0; t <= scene.duration; t += 0.5) {
          if (valueAt(who, "opacity", t) < 0.05 || valueAt(prop, "opacity", t) < 0.05) continue;
          const box = solidFootprint(scene, prop, t, true);
          // Low things (chairs, beds, rugs) are sat on or stepped over.
          if (!box || box.y1 < 150 || activeLink(who, t)?.parent === prop.id) continue;
          const x = worldState(scene, who, t).x;
          const z = valueAt(who, "z", t);
          if (x > box.x0 + 10 && x < box.x1 - 10 && z > box.z0 - 20 && z < box.z1 + 20) {
            const back = Math.round(z - 40 - (box.z1 - valueAt(prop, "z", t)));
            out.push(`"${who.id}" is inside "${prop.id}" around ${t}s: the prop fills x ${Math.round(box.x0)}..${Math.round(box.x1)} and z ${Math.round(box.z0)}..${Math.round(box.z1)}, and "${who.id}" is at x ${Math.round(x)} z ${Math.round(z)}. Props are deep (a house is about 300): move "${prop.id}" back to z ${back} or less, or move "${who.id}" out of that area.`);
            break;
          }
        }
      }
    }
  }

  for (const who of scene.objects.filter((o): o is StickmanObj => o.type === "stickman")) {
    let warnedSit = false;
    for (let t = 0; t <= scene.duration && !warnedSit; t += 0.5) {
      const hipY = valueAt(who, "hipY", t);
      const thigh = (valueAt(who, "lHip", t) + valueAt(who, "rHip", t)) / 2;
      const chairSit = hipY > 25 && hipY < 70 && thigh > 55;
      if (!chairSit || Math.abs(valueAt(who, "rotation", t)) > 20) continue;
      const tf = stickmanTransform(who, t);
      const hip = tf.toWorld(stickmanPoints(who, t).hip);
      const supported = scene.objects.some(
        (o) => o.id !== who.id && (o.type === "drawing" || o.type === "image") && valueAt(o, "opacity", t) > 0.05 && contains(objectBounds(undefined, scene, o, t), hip.x, hip.y + 14, 6)
      );
      if (!supported) {
        out.push(`"${who.id}" sits on nothing at ${t.toFixed(1)}s (hips at x${Math.round(hip.x)} y${Math.round(hip.y)}). Draw a chair or bench there, or use {"op":"pose","pose":"sit","on":"<chair id>"}.`);
        warnedSit = true;
      }
    }
  }

  for (const op of applied) {
    if (op.op === "action" && op.action === "write") {
      const who = findObj(scene, op.id);
      if (!who || who.type !== "stickman") continue;
      const t = op.at + 0.5;
      const tf = stickmanTransform(who, t);
      const hand = tf.toWorld(stickmanPoints(who, t).rHand);
      const near = drawings.some((d) => contains(objectBounds(undefined, scene, d, t), hand.x, hand.y, 40));
      if (!near) out.push(`"${op.id}" does "write" at ${op.at}s but its hand (x${Math.round(hand.x)} y${Math.round(hand.y)}) is not on any board. Use {"op":"write","id":"${op.id}","on":"<board id>","text":"...","at":${op.at}} instead.`);
    }
    if ((op.op === "action" && !["fall", "getUp"].includes(op.action)) || (op.op === "pose" && !op.on)) {
      const who = findObj(scene, op.id);
      if (who && who.type === "stickman") {
        const t = op.at + 0.15;
        const moving = Math.abs(valueAt(who, "x", t + 0.1) - valueAt(who, "x", t - 0.1)) > 2;
        if (moving) {
          let end = t;
          while (end < scene.duration && Math.abs(valueAt(who, "x", end + 0.1) - valueAt(who, "x", end)) > 0.5) end += 0.1;
          out.push(`"${op.id}" starts ${op.op === "action" ? op.action : `pose ${op.pose}`} at ${op.at}s while still walking (until ≈${end.toFixed(1)}s). Start it after the walk ends.`);
        }
      }
    }
    if (op.op === "action" && ["jump", "celebrate", "dance", "stomp", "kick", "bow", "fall", "punch"].includes(op.action)) {
      const who = findObj(scene, op.id);
      if (who && who.type === "stickman" && valueAt(who, "hipY", op.at) > 25 && valueAt(who, "hipY", op.at + 0.2) > 20) {
        out.push(`"${op.id}" does ${op.action} at ${op.at}s while sitting. Add {"op":"pose","id":"${op.id}","pose":"stand","at":${op.at}} and start the ${op.action} 0.5s later.`);
      }
    }
    if (op.op === "say" && op.character) {
      const who = findObj(scene, op.character);
      if (who && who.type === "stickman" && valueAt(who, "opacity", op.at) < 0.05) out.push(`"${op.character}" speaks at ${op.at}s while hidden.`);
    }
  }

  // Characters and animals standing inside each other (brief passes while walking are fine).
  const actors = scene.objects.filter((o) => o.type === "stickman" || o.type === "creature");
  // How much of the narrower one is covered sideways, when they also share height.
  const overlap = (a: Rect, b: Rect) => {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w / Math.min(a.w, b.w) : 0;
  };
  for (let i = 0; i < actors.length; i++) {
    for (let j = i + 1; j < actors.length; j++) {
      const a = actors[i];
      const b = actors[j];
      if (activeLink(a, 0)?.parent === b.id || activeLink(b, 0)?.parent === a.id) continue;
      let run = 0;
      for (let t = 0; t <= scene.duration; t += 0.5) {
        if (valueAt(a, "opacity", t) < 0.05 || valueAt(b, "opacity", t) < 0.05 || activeLink(a, t) || activeLink(b, t)) {
          run = 0;
          continue;
        }
        const both = a.type === "stickman" && b.type === "stickman";
        const wa = worldState(scene, a, t);
        const wb = worldState(scene, b, t);
        // In 3D people have bodies in depth too: closer than about a shoulder width means bumping faces.
        const hit = both
          ? scene.mode === "3d"
            ? Math.hypot(wa.x - wb.x, valueAt(a, "z", t) - valueAt(b, "z", t)) < 60 * Math.max(a.scale, b.scale) && Math.abs(wa.y - wb.y) < 40
            : Math.abs(wa.x - wb.x) < 28 && Math.abs(wa.y - wb.y) < 40
          : overlap(objectBounds(undefined, scene, a, t), objectBounds(undefined, scene, b, t)) > 0.6;
        run = hit ? run + 1 : 0;
        if (run >= 2) {
          out.push(`"${a.id}" and "${b.id}" stand inside each other around ${t}s. Keep a gap: walk one of them to "to" the other (it stops beside) or pick x values at least ${both ? Math.round((scene.mode === "3d" ? 110 : 60) * Math.max(a.scale, b.scale)) : 110}px apart.`);
          break;
        }
      }
    }
  }
  return [...new Set(out)].slice(0, 12);
}
