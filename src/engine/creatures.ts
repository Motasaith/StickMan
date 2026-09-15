// Data-driven skeletons: bones with shapes attached, animated by rotating bones.
// Presets (dog, cat, bird, fish) are built here; the AI can also send its own bones.

import type { BoneDef, CreatureObj, Ease, Part, Species } from "./scene";
import type { Ctx } from "./render";
import { drawParts, partBounds, type Rect } from "./render";
import { animateTrack, baseValue, removeKeys, valueAt } from "./tracks";

// ── Matrices ─────────────────────────────────────────────────────────

export interface Mat {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export const IDENTITY: Mat = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function mul(m: Mat, n: Mat): Mat {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

export const translate = (x: number, y: number): Mat => ({ a: 1, b: 0, c: 0, d: 1, e: x, f: y });
export const rotate = (deg: number): Mat => {
  const r = (deg * Math.PI) / 180;
  return { a: Math.cos(r), b: Math.sin(r), c: -Math.sin(r), d: Math.cos(r), e: 0, f: 0 };
};
export const apply = (m: Mat, x: number, y: number) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });

// ── Presets ──────────────────────────────────────────────────────────

export function shade(color: string, amount: number): string {
  const m = color.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return color;
  let hex = m[1];
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  const n = parseInt(hex, 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount >= 0 ? c * (1 - amount) : c + (255 - c) * -amount)));
  const h = (v: number) => f(v).toString(16).padStart(2, "0");
  return `#${h((n >> 16) & 255)}${h((n >> 8) & 255)}${h(n & 255)}`;
}

const O = "#1a1a1a";
const bone = (name: string, parent: string | null, x: number, y: number, angle: number, length: number, z: number, parts: Part[]): BoneDef => ({
  name,
  parent,
  x,
  y,
  angle,
  length,
  z,
  parts,
});
const limbRect = (len: number, w: number, fill: string): Part => ({ kind: "rect", x: -w / 2, y: -w / 2, w: len + w, h: w, r: w / 2, fill, stroke: O, width: 2.5 });

export const SPECIES_DEFAULTS: Record<Exclude<Species, "custom">, { color: string; accent: string }> = {
  dog: { color: "#c68642", accent: "#7a4a1c" },
  cat: { color: "#9aa0a6", accent: "#f7a8b8" },
  bird: { color: "#4ea8de", accent: "#ffd166" },
  fish: { color: "#ff8c42", accent: "#ffd166" },
};

/** Where the eyes are, so they can blink and close. */
export const EYES: Record<Exclude<Species, "custom">, { bone: string; x: number; y: number; r: number }> = {
  dog: { bone: "head", x: 12, y: -6, r: 3 },
  cat: { bone: "head", x: 10, y: -4, r: 2.8 },
  bird: { bone: "head", x: 6, y: -3, r: 2.4 },
  fish: { bone: "body", x: 32, y: -4, r: 3 },
};

function quadruped(kind: "dog" | "cat", color: string, accent: string): BoneDef[] {
  const cat = kind === "cat";
  const far = shade(color, 0.22);
  const legW = cat ? 9 : 12;
  const u = cat ? 20 : 22;
  const l = cat ? 22 : 24;
  const bodyY = -(u + l) - 10;
  const bodyLen = cat ? 64 : 76;
  const bones: BoneDef[] = [
    bone("body", null, -bodyLen / 2, bodyY, 0, bodyLen, 2, [
      { kind: "ellipse", cx: bodyLen / 2, cy: 0, rx: bodyLen / 2 + 12, ry: cat ? 16 : 21, fill: color, stroke: O, width: 2.5 },
    ]),
    bone("neck", "body", bodyLen - 6, -8, -55, cat ? 16 : 20, 3, [{ kind: "rect", x: -3, y: -8, w: (cat ? 16 : 20) + 6, h: 16, r: 7, fill: color }]),
    bone("head", "neck", cat ? 16 : 20, 0, 55, 28, 5, cat
      ? [
          { kind: "poly", points: [-9, -9, -5, -27, 4, -13], closed: true, fill: color, stroke: O, width: 2.5 },
          { kind: "poly", points: [-6, -12, -4.5, -21, 1, -13], closed: true, fill: accent },
          { kind: "poly", points: [3, -13, 12, -26, 14, -8], closed: true, fill: color, stroke: O, width: 2.5 },
          { kind: "circle", cx: 4, cy: 0, r: 15, fill: color, stroke: O, width: 2.5 },
          { kind: "ellipse", cx: 17, cy: 5, rx: 7, ry: 5, fill: shade(color, -0.35), stroke: O, width: 2 },
          { kind: "circle", cx: 23, cy: 3, r: 2.6, fill: accent },
          { kind: "line", x1: 18, y1: 7, x2: 34, y2: 4, stroke: O, width: 1.2 },
          { kind: "line", x1: 18, y1: 9, x2: 33, y2: 11, stroke: O, width: 1.2 },
        ]
      : [
          { kind: "circle", cx: 6, cy: 0, r: 17, fill: color, stroke: O, width: 2.5 },
          { kind: "ellipse", cx: 24, cy: 5, rx: 14, ry: 9, fill: shade(color, -0.25), stroke: O, width: 2.5 },
          { kind: "circle", cx: 37, cy: 1, r: 4.5, fill: O },
          { kind: "poly", points: [-8, -12, 6, -15, -2, 14], closed: true, fill: accent, stroke: O, width: 2.5 },
        ]),
    bone("jaw", "head", cat ? 12 : 16, cat ? 8 : 11, 0, cat ? 12 : 20, 4, [
      { kind: "rect", x: -2, y: -2, w: (cat ? 12 : 20) + 2, h: 6, r: 3, fill: shade(color, -0.2), stroke: O, width: 2 },
    ]),
    bone("tail", "body", -10, -6, cat ? 235 : 205, cat ? 30 : 26, 1, [{ kind: "line", x1: 0, y1: 0, x2: cat ? 30 : 26, y2: 0, stroke: color, width: cat ? 6 : 8 }]),
    bone("tail2", "tail", cat ? 30 : 26, 0, cat ? -45 : -25, cat ? 26 : 18, 1, [{ kind: "line", x1: 0, y1: 0, x2: cat ? 26 : 18, y2: 0, stroke: color, width: cat ? 6 : 7 }]),
  ];
  const leg = (name: string, x: number, fill: string, z: number) => {
    bones.push(bone(`${name}Leg`, "body", x, 10, 90, u, z, [limbRect(u, legW, fill)]));
    bones.push(
      bone(`${name}Shin`, `${name}Leg`, u, 0, 0, l, z, [
        limbRect(l, legW - 2, fill),
        { kind: "ellipse", cx: l, cy: -3, rx: legW * 0.45, ry: legW * 0.75, fill, stroke: O, width: 2.5 },
      ])
    );
  };
  leg("front2", bodyLen - 8, far, 0);
  leg("back2", 10, far, 0);
  leg("front", bodyLen - 16, color, 6);
  leg("back", 4, color, 6);
  return bones;
}

function birdRig(color: string, accent: string): BoneDef[] {
  const beak = "#f4a261";
  return [
    bone("body", null, -18, -34, 0, 36, 2, [
      { kind: "ellipse", cx: 18, cy: 0, rx: 24, ry: 16, fill: color, stroke: O, width: 2.5 },
      { kind: "ellipse", cx: 24, cy: 6, rx: 13, ry: 8, fill: accent },
    ]),
    bone("tail", "body", -4, -2, 195, 18, 1, [{ kind: "poly", points: [0, -5, 22, -11, 24, 9, 0, 5], closed: true, fill: shade(color, 0.2), stroke: O, width: 2.5 }]),
    bone("head", "body", 34, -12, 0, 14, 4, [
      { kind: "circle", cx: 4, cy: 0, r: 12, fill: color, stroke: O, width: 2.5 },
      { kind: "poly", points: [13, -5, 27, 0, 13, 2], closed: true, fill: beak, stroke: O, width: 2 },
    ]),
    bone("jaw", "head", 13, 2, 0, 12, 3, [{ kind: "poly", points: [0, 0, 12, 0, 0, 5], closed: true, fill: shade(beak, 0.15), stroke: O, width: 2 }]),
    bone("wing2", "body", 22, -6, 175, 30, 0, [{ kind: "ellipse", cx: 14, cy: 0, rx: 17, ry: 7, fill: shade(color, 0.3), stroke: O, width: 2.5 }]),
    bone("wing", "body", 18, -2, 175, 30, 5, [{ kind: "ellipse", cx: 14, cy: 0, rx: 17, ry: 8, fill: shade(color, 0.12), stroke: O, width: 2.5 }]),
    bone("leg2", "body", 12, 13, 90, 21, 0, [
      { kind: "line", x1: 0, y1: 0, x2: 21, y2: 0, stroke: beak, width: 3 },
      { kind: "line", x1: 21, y1: 0, x2: 21, y2: -8, stroke: beak, width: 3 },
    ]),
    bone("leg", "body", 20, 13, 90, 21, 3, [
      { kind: "line", x1: 0, y1: 0, x2: 21, y2: 0, stroke: beak, width: 3 },
      { kind: "line", x1: 21, y1: 0, x2: 21, y2: -9, stroke: beak, width: 3 },
    ]),
  ];
}

function fishRig(color: string, accent: string): BoneDef[] {
  return [
    bone("tailBase", "body", -16, 0, 180, 18, 1, [{ kind: "ellipse", cx: 9, cy: 0, rx: 13, ry: 11, fill: color, stroke: O, width: 2.5 }]),
    bone("tail", "tailBase", 18, 0, 0, 18, 1, [{ kind: "poly", points: [-2, 0, 22, -17, 15, 0, 22, 17], closed: true, fill: accent, stroke: O, width: 2.5 }]),
    bone("body", null, -8, 0, 0, 30, 2, [
      { kind: "poly", points: [0, -14, 12, -30, 26, -14], closed: true, fill: accent, stroke: O, width: 2.5 },
      { kind: "ellipse", cx: 12, cy: 0, rx: 30, ry: 17, fill: color, stroke: O, width: 2.5 },
      { kind: "line", x1: 22, y1: -12, x2: 22, y2: 12, stroke: shade(color, 0.25), width: 2 },
    ]),
    bone("jaw", "body", 38, 5, 0, 5, 3, [{ kind: "line", x1: 0, y1: 0, x2: 5, y2: 0, stroke: O, width: 2 }]),
    bone("fin", "body", 14, 6, 120, 12, 4, [{ kind: "ellipse", cx: 7, cy: 0, rx: 9, ry: 4.5, fill: accent, stroke: O, width: 2 }]),
  ];
}

const rigCache = new Map<string, BoneDef[]>();

export function rigOf(obj: CreatureObj): BoneDef[] {
  if (obj.species === "custom") return obj.rig ?? [];
  const key = `${obj.species}|${obj.color}|${obj.accent}`;
  let rig = rigCache.get(key);
  if (!rig) {
    rig =
      obj.species === "dog" || obj.species === "cat"
        ? quadruped(obj.species, obj.color, obj.accent)
        : obj.species === "bird"
          ? birdRig(obj.color, obj.accent)
          : fishRig(obj.color, obj.accent);
    rigCache.set(key, rig);
  }
  return rig;
}

// ── Solving and drawing ──────────────────────────────────────────────

export interface SolvedBone {
  def: BoneDef;
  m: Mat;
  /** Absolute angle in degrees in creature space. */
  angle: number;
}

/** World matrices in the creature's local space (facing right, ground at y=0). */
export function solveCreature(obj: CreatureObj, t: number, mouth = 0): Map<string, SolvedBone> {
  const bones = rigOf(obj);
  const out = new Map<string, SolvedBone>();
  const rootY = valueAt(obj, "rootY", t);
  const pending = [...bones];
  let guard = 0;
  while (pending.length && guard++ < 200) {
    const def = pending.shift()!;
    const parent = def.parent ? out.get(def.parent) : undefined;
    if (def.parent && !parent) {
      if (bones.some((b) => b.name === def.parent)) pending.push(def);
      continue;
    }
    let offset = valueAt(obj, `b.${def.name}`, t);
    if (def.name === "jaw") offset += Math.min(1, mouth + valueAt(obj, "mouth", t)) * 28;
    const local = mul(translate(def.x, def.y + (parent ? 0 : rootY)), rotate(def.angle + offset));
    const m = parent ? mul(parent.m, local) : local;
    out.set(def.name, { def, m, angle: (parent?.angle ?? 0) + def.angle + offset });
  }
  return out;
}

export function drawCreature(ctx: Ctx, obj: CreatureObj, t: number, mouth: number) {
  const solved = solveCreature(obj, t, mouth);
  const order = [...solved.values()].sort((p, q) => (p.def.z ?? 0) - (q.def.z ?? 0));
  const eyes = obj.species !== "custom" ? EYES[obj.species] : null;
  const eyesOpen = valueAt(obj, "eyes", t);
  for (const sb of order) {
    ctx.save();
    ctx.transform(sb.m.a, sb.m.b, sb.m.c, sb.m.d, sb.m.e, sb.m.f);
    drawParts(ctx, sb.def.parts);
    if (eyes && eyes.bone === sb.def.name) {
      ctx.fillStyle = O;
      ctx.strokeStyle = O;
      if (eyesOpen > 0.5) {
        ctx.beginPath();
        ctx.arc(eyes.x, eyes.y, eyes.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(eyes.x - eyes.r * 1.3, eyes.y);
        ctx.lineTo(eyes.x + eyes.r * 1.3, eyes.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/** Bounds in the creature's local space. */
export function creatureLocalBounds(obj: CreatureObj, t: number): Rect {
  const solved = solveCreature(obj, t);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const sb of solved.values()) {
    for (const part of sb.def.parts) {
      const b = partBounds(part);
      for (const [x, y] of [
        [b.x, b.y],
        [b.x + b.w, b.y],
        [b.x, b.y + b.h],
        [b.x + b.w, b.y + b.h],
      ]) {
        const p = apply(sb.m, x, y);
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
    }
  }
  if (!isFinite(minX)) return { x: -20, y: -40, w: 40, h: 40 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// ── Motion ───────────────────────────────────────────────────────────

export const CREATURE_ACTIONS = ["wagTail", "bark", "sniff", "jump", "nod", "lookAround", "flap", "peck", "sing", "sleep", "wakeUp", "stretch"] as const;
export type CreatureAction = (typeof CREATURE_ACTIONS)[number];
export const CREATURE_POSES = ["stand", "sit", "lie"] as const;
export type CreaturePose = (typeof CREATURE_POSES)[number];

const ACTIONS_BY_SPECIES: Record<Species, readonly CreatureAction[]> = {
  dog: ["wagTail", "bark", "sniff", "jump", "nod", "lookAround", "sleep", "wakeUp", "stretch"],
  cat: ["wagTail", "bark", "sniff", "jump", "nod", "lookAround", "sleep", "wakeUp", "stretch"],
  bird: ["flap", "peck", "sing", "jump", "nod", "lookAround", "sleep", "wakeUp"],
  fish: ["wagTail", "jump", "sing", "lookAround"],
  custom: ["nod", "jump", "lookAround", "wagTail"],
};

export function creatureActionsFor(species: Species) {
  return ACTIONS_BY_SPECIES[species];
}

type BoneValues = Record<string, number>;

function animBones(obj: CreatureObj, values: BoneValues, start: number, dur: number, e: Ease = "easeInOut") {
  const bones = new Set(rigOf(obj).map((b) => b.name));
  for (const [name, v] of Object.entries(values)) {
    const prop = ["rootY", "mouth", "eyes", "y", "x", "rotation"].includes(name) ? name : `b.${name}`;
    if (prop.startsWith("b.") && !bones.has(name)) continue;
    animateTrack(obj.tracks, prop, baseValue(obj, prop), v, start, dur, e);
  }
}

function currentValues(obj: CreatureObj, names: string[], t: number): BoneValues {
  const out: BoneValues = {};
  for (const n of names) out[n] = valueAt(obj, ["rootY", "mouth", "eyes", "y", "x", "rotation"].includes(n) ? n : `b.${n}`, t);
  return out;
}

const QUAD_POSES: Record<CreaturePose, BoneValues> = {
  stand: { body: 0, rootY: 0, neck: 0, head: 0, frontLeg: 0, frontShin: 0, front2Leg: 0, front2Shin: 0, backLeg: 0, backShin: 0, back2Leg: 0, back2Shin: 0, tail: 0, tail2: 0 },
  sit: { body: -30, rootY: 34, neck: 22, head: 10, frontLeg: 22, frontShin: -6, front2Leg: 22, front2Shin: -6, backLeg: -58, backShin: 140, back2Leg: -58, back2Shin: 140, tail: 45, tail2: 20 },
  lie: { body: 0, rootY: 32, neck: 30, head: -22, frontLeg: -78, frontShin: -8, front2Leg: -74, front2Shin: -8, backLeg: -75, backShin: 10, back2Leg: -70, back2Shin: 10, tail: 40, tail2: 10 },
};
const BIRD_POSES: Record<CreaturePose, BoneValues> = {
  stand: { body: 0, rootY: 0, leg: 0, leg2: 0, wing: 0, wing2: 0, head: 0 },
  sit: { body: 0, rootY: 14, leg: -60, leg2: -60, wing: 0, wing2: 0, head: 0 },
  lie: { body: 0, rootY: 16, leg: -80, leg2: -80, wing: 0, wing2: 0, head: 15 },
};

export function creaturePose(obj: CreatureObj, pose: CreaturePose, start: number, dur = 0.5): number {
  const table = obj.species === "dog" || obj.species === "cat" ? QUAD_POSES : obj.species === "bird" ? BIRD_POSES : null;
  if (!table) return start;
  const values = { ...table[pose] };
  // Tails rest on the ground when sitting or lying (the cat's tail starts higher).
  if (pose !== "stand" && (obj.species === "dog" || obj.species === "cat")) {
    values.tail = obj.species === "cat" ? -62 : -28;
    values.tail2 = obj.species === "cat" ? 40 : 20;
  }
  if (pose !== "stand") values.rootY = (values.rootY ?? 0) + groundOffset(obj, values);
  animBones(obj, values, start, dur);
  return start + dur;
}

/** How far to move the body down so the lowest paw or foot (not the tail) touches the ground in this pose. */
function groundOffset(obj: CreatureObj, values: BoneValues): number {
  const probe: CreatureObj = { ...obj, tracks: {} };
  for (const [name, v] of Object.entries(values)) {
    const prop = ["rootY", "mouth", "eyes"].includes(name) ? name : `b.${name}`;
    probe.tracks[prop] = [{ t: 0, v }];
  }
  let bottom = -Infinity;
  for (const sb of solveCreature(probe, 0).values()) {
    if (/tail/i.test(sb.def.name)) continue;
    for (const part of sb.def.parts) {
      const b = partBounds(part);
      for (const [x, y] of [
        [b.x, b.y],
        [b.x + b.w, b.y],
        [b.x, b.y + b.h],
        [b.x + b.w, b.y + b.h],
      ]) bottom = Math.max(bottom, apply(sb.m, x, y).y);
    }
  }
  // Part outlines add a couple of pixels; let paws rest just on the line.
  return isFinite(bottom) ? -(bottom - 2) : 0;
}

function setFacingCreature(obj: CreatureObj, dir: 1 | -1, at: number) {
  if (Math.sign(valueAt(obj, "facing", at)) === dir) return;
  animateTrack(obj.tracks, "facing", baseValue(obj, "facing"), dir, at, 0, "step");
}

function clearBoneKeys(obj: CreatureObj, from: number, to: number) {
  for (const [prop, keys] of Object.entries(obj.tracks)) if (prop.startsWith("b.") || prop === "rootY") removeKeys(keys, from, to);
}

/** Walk, run, hop or swim to x. Returns the end time. */
export function creatureMove(obj: CreatureObj, toX: number, start: number, duration: number | undefined, style: "walk" | "run" | "sneak" | "fly"): number {
  const x0 = valueAt(obj, "x", start);
  const dist = toX - x0;
  if (Math.abs(dist) < 1) return start;
  const s = Math.abs(obj.scale) || 1;
  setFacingCreature(obj, dist > 0 ? 1 : -1, start);

  if (obj.species === "fish") {
    const D = duration ?? Math.abs(dist) / (120 * s);
    animateTrack(obj.tracks, "x", obj.x, toX, start, D, "easeInOut");
    clearBoneKeys(obj, start, start + D);
    return cycleBones(obj, { tailBase: 18, tail: -28, body: 3, fin: 30 }, 0.55, start, D, 0.25);
  }
  if (obj.species === "bird") {
    if (style === "fly") return birdFly(obj, toX, valueAt(obj, "y", start), start, duration);
    const hops = Math.max(1, Math.round(Math.abs(dist) / (32 * s)));
    const hop = duration ? duration / hops : 0.28;
    clearBoneKeys(obj, start, start + hops * hop);
    for (let i = 0; i < hops; i++) {
      const t0 = start + i * hop;
      animateTrack(obj.tracks, "x", obj.x, x0 + (dist * (i + 1)) / hops, t0, hop, "easeInOut");
      animBones(obj, { rootY: -14, leg: -30, leg2: -30, wing: -25 }, t0, hop * 0.45, "easeOut");
      animBones(obj, { rootY: 0, leg: 0, leg2: 0, wing: 0 }, t0 + hop * 0.45, hop * 0.55, "easeIn");
    }
    return start + hops * hop;
  }
  if (obj.species === "custom") {
    const D = duration ?? Math.abs(dist) / (150 * s);
    animateTrack(obj.tracks, "x", obj.x, toX, start, D, "linear");
    const legs = rigOf(obj).filter((b) => /leg|foot|paw/i.test(b.name));
    const amps: BoneValues = {};
    legs.forEach((b, i) => (amps[b.name] = i % 2 === 0 ? 22 : -22));
    return legs.length ? cycleBones(obj, amps, 0.5, start, D) : start + D;
  }

  // Dogs and cats: diagonal leg pairs, strides sized to the distance.
  const run = style === "run";
  const sneak = style === "sneak";
  const amp = run ? 38 : sneak ? 16 : 24;
  const legLen = obj.species === "cat" ? 42 : 46;
  const stride = 2 * legLen * Math.sin((amp * Math.PI) / 180) * s * (run ? 1.9 : 1);
  const speed = (run ? 520 : sneak ? 70 : 170) * s;
  const D = duration && duration > 0 ? duration : Math.abs(dist) / speed;
  const steps = Math.max(1, Math.round(Math.abs(dist) / stride));
  const stepDur = D / steps;
  animateTrack(obj.tracks, "x", obj.x, toX, start, D, "linear");
  const before = currentValues(obj, Object.keys(QUAD_POSES.stand), start);
  clearBoneKeys(obj, start, start + D + 0.3);
  let prev = start;
  const key = (t: number, v: BoneValues) => {
    animBones(obj, v, prev, t - prev, "linear");
    prev = t;
  };
  const crouch = sneak ? 10 : 0;
  for (let i = 0; i < steps; i++) {
    const a = i % 2 === 0 ? 1 : -1;
    const tc = start + (i + 0.5) * stepDur;
    const tp = start + (i + 1) * stepDur;
    if (run) {
      key(tc, { frontLeg: -amp, front2Leg: -amp + 8, backLeg: amp, back2Leg: amp - 8, frontShin: 10, backShin: -10, body: -6, rootY: -14, neck: -6, tail: -20 });
      key(tp, { frontLeg: amp * 0.8, front2Leg: amp * 0.8 - 8, backLeg: -amp * 0.8, back2Leg: -amp * 0.8 + 8, frontShin: 40, backShin: -40, body: 6, rootY: 2, neck: 6, tail: 10 });
    } else {
      key(tc, {
        frontLeg: -amp * a, back2Leg: -amp * a, front2Leg: amp * a, backLeg: amp * a,
        frontShin: 4, front2Shin: 4, backShin: -4, back2Shin: -4,
        rootY: 3 + crouch, neck: 3 + crouch, tail: 14 * a, body: 0,
      });
      key(tp, {
        frontLeg: 0, back2Leg: 0, front2Leg: 0, backLeg: 0,
        [a > 0 ? "front2Shin" : "frontShin"]: 38, [a > 0 ? "backShin" : "back2Shin"]: -38,
        [a > 0 ? "frontShin" : "front2Shin"]: 0, [a > 0 ? "back2Shin" : "backShin"]: 0,
        rootY: -1 + crouch, neck: -2 + crouch, tail: -14 * a,
      });
    }
  }
  const standing = Math.abs(before.rootY) < 8;
  key(start + D + 0.3, standing ? before : QUAD_POSES.stand);
  return start + D + 0.3;
}

function birdFly(obj: CreatureObj, toX: number, toY: number, start: number, duration?: number): number {
  const x0 = valueAt(obj, "x", start);
  const y0 = valueAt(obj, "y", start);
  const dist = Math.hypot(toX - x0, toY - y0);
  const D = duration ?? Math.max(0.8, dist / 260);
  const lift = Math.min(140, 40 + dist * 0.25);
  animateTrack(obj.tracks, "x", obj.x, toX, start, D, "easeInOut");
  // Arc: rise to a peak, then settle on the target height.
  animateTrack(obj.tracks, "y", obj.y, Math.min(y0, toY) - lift, start, D / 2, "easeOut");
  animateTrack(obj.tracks, "y", obj.y, toY, start + D / 2, D / 2, "easeIn");
  clearBoneKeys(obj, start, start + D + 0.3);
  animBones(obj, { leg: -70, leg2: -70, body: -8 }, start, 0.15);
  const end = cycleBones(obj, { wing: -70, wing2: -70 }, 0.18, start, D, 0, 20);
  animBones(obj, { leg: 0, leg2: 0, body: 0, wing: 0, wing2: 0 }, end, 0.25);
  return end + 0.25;
}

export function birdFlyTo(obj: CreatureObj, x: number, y: number, start: number, duration?: number) {
  const x0 = valueAt(obj, "x", start);
  if (Math.abs(x - x0) > 1) setFacingCreature(obj, x > x0 ? 1 : -1, start);
  return birdFly(obj, x, y, start, duration);
}

/**
 * Oscillate bones (or joints, for any keyed prop names) around their current value.
 * amplitude per bone in degrees; offsetPhase shifts each successive bone by that fraction.
 */
export function cycleBones(obj: CreatureObj, amps: BoneValues, period: number, start: number, duration: number, phaseStep = 0, bias = 0): number {
  const names = Object.keys(amps);
  const base = currentValues(obj, names, start);
  const quarter = period / 4;
  const count = Math.max(1, Math.round(duration / quarter));
  names.forEach((n, bi) => {
    const prop = ["rootY", "mouth", "eyes"].includes(n) ? n : `b.${n}`;
    const shift = Math.round(phaseStep * bi * 4);
    let prev = start;
    for (let i = 1; i <= count; i++) {
      const t = start + i * quarter;
      const phase = (i + shift) % 4;
      const v = base[n] + bias * Math.sign(amps[n]) + amps[n] * [0, 1, 0, -1][phase];
      animateTrack(obj.tracks, prop, baseValue(obj, prop), i === count ? base[n] : v, prev, t - prev, "easeInOut");
      prev = t;
    }
  });
  return start + count * quarter;
}

export function playCreatureAction(obj: CreatureObj, action: CreatureAction, start: number, times = 2): number {
  const allowed = ACTIONS_BY_SPECIES[obj.species];
  if (!allowed.includes(action)) throw new Error(`a ${obj.species} can't ${action} (it can: ${allowed.join(", ")})`);
  const n = Math.max(1, Math.min(20, times));
  const quad = obj.species === "dog" || obj.species === "cat";
  switch (action) {
    case "wagTail":
      if (obj.species === "fish") return cycleBones(obj, { tailBase: 22, tail: -32 }, 0.3, start, 0.3 * n);
      return cycleBones(obj, { tail: 30, tail2: -20 }, 0.24, start, 0.24 * n * 2);
    case "bark":
    case "sing": {
      let t = start;
      const head: BoneValues = obj.species === "bird" ? { head: -18 } : quad ? { neck: -12, head: -8 } : {};
      const back = currentValues(obj, Object.keys(head), start);
      for (let i = 0; i < n; i++) {
        animBones(obj, { ...head, mouth: 1 }, t, 0.1, "easeOut");
        animBones(obj, { ...back, mouth: 0 }, t + 0.1, 0.16, "easeIn");
        t += action === "sing" ? 0.35 : 0.3;
      }
      return t;
    }
    case "sniff": {
      const back = currentValues(obj, ["neck", "head"], start);
      animBones(obj, { neck: 60, head: 25 }, start, 0.35);
      const end = cycleBones(obj, { head: 6 }, 0.2, start + 0.35, 0.2 * n * 2);
      animBones(obj, back, end, 0.35);
      return end + 0.35;
    }
    case "peck": {
      let t = start;
      const back = currentValues(obj, ["body", "head"], start);
      for (let i = 0; i < n; i++) {
        animBones(obj, { body: 35, head: 25 }, t, 0.12, "easeIn");
        animBones(obj, back, t + 0.12, 0.18, "easeOut");
        t += 0.34;
      }
      return t;
    }
    case "flap":
      return cycleBones(obj, { wing: -70, wing2: -70 }, 0.2, start, 0.2 * n * 2, 0, 20);
    case "jump": {
      const y0 = valueAt(obj, "y", start);
      const h = obj.species === "fish" ? 120 : obj.species === "bird" ? 50 : 90;
      let t = start;
      for (let i = 0; i < n; i++) {
        if (quad) animBones(obj, { rootY: 10, frontLeg: 15, backLeg: -15, frontShin: 25, backShin: -25 }, t, 0.2);
        animateTrack(obj.tracks, "y", obj.y, y0 - h * obj.scale, t + 0.2, 0.3, "easeOut");
        if (quad) animBones(obj, { rootY: -4, frontLeg: -45, front2Leg: -40, backLeg: 45, back2Leg: 40, frontShin: 0, backShin: 0, body: -12 }, t + 0.2, 0.3, "easeOut");
        if (obj.species === "fish") animBones(obj, { body: -30 }, t + 0.2, 0.3);
        animateTrack(obj.tracks, "y", obj.y, y0, t + 0.5, 0.3, "easeIn");
        if (quad) animBones(obj, { ...QUAD_POSES.stand }, t + 0.5, 0.35);
        if (obj.species === "fish") animBones(obj, { body: 30 }, t + 0.5, 0.3);
        t += 0.85;
      }
      if (obj.species === "fish") animBones(obj, { body: 0 }, t, 0.2);
      return t + 0.2;
    }
    case "nod": {
      const bone = obj.species === "fish" ? "body" : "head";
      return cycleBones(obj, { [bone]: 14 }, 0.36, start, 0.36 * n);
    }
    case "lookAround": {
      const bone = obj.species === "fish" ? "body" : quad ? "neck" : "head";
      return cycleBones(obj, { [bone]: -20 }, 0.9, start, 0.9 * n);
    }
    case "sleep": {
      const end = creaturePose(obj, "lie", start, 0.6);
      animBones(obj, { eyes: 0 }, end, 0, "step");
      if (quad) animBones(obj, { neck: 55, head: -30 }, start, 0.8);
      return end;
    }
    case "wakeUp": {
      animBones(obj, { eyes: 1 }, start, 0, "step");
      return creaturePose(obj, "stand", start + 0.3, 0.6);
    }
    case "stretch": {
      const back = currentValues(obj, Object.keys(QUAD_POSES.stand), start);
      animBones(obj, { frontLeg: -45, front2Leg: -40, frontShin: 0, body: 18, rootY: 12, neck: -10, tail: -40 }, start, 0.6);
      animBones(obj, back, start + 0.6 + 0.5 * n, 0.5);
      return start + 1.1 + 0.5 * n;
    }
  }
}
