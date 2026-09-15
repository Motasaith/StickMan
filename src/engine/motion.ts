// Motions a person would build by hand: walk cycles, gestures, pose changes.
// Each one writes ordinary keyframes, so everything stays editable afterwards.

import type { Ease, Joints, JointName, StickmanObj } from "./scene";
import { EXPRESSIONS, JOINTS } from "./scene";
import { BONES, LEG, POSES, STAND, jointsAt, type PoseName } from "./rig";
import { animateTrack, baseValue, removeKeys, valueAt } from "./tracks";

const DEG = Math.PI / 180;

function animateJoints(obj: StickmanObj, joints: Partial<Joints>, start: number, dur: number, e: Ease = "easeInOut") {
  for (const [name, v] of Object.entries(joints) as [JointName, number][]) {
    animateTrack(obj.tracks, name, baseValue(obj, name), v, start, dur, e);
  }
}

function animateProp(obj: StickmanObj, prop: string, to: number, start: number, dur: number, e: Ease = "easeInOut") {
  animateTrack(obj.tracks, prop, baseValue(obj, prop), to, start, dur, e);
}

export function transitionToPose(obj: StickmanObj, pose: PoseName, start: number, dur = 0.4): number {
  animateJoints(obj, POSES[pose], start, dur);
  return start + dur;
}

export function setFacing(obj: StickmanObj, dir: 1 | -1, at: number) {
  if (Math.sign(valueAt(obj, "facing", at)) === dir) return;
  animateProp(obj, "facing", dir, at, 0, "step");
}

export function setExpression(obj: StickmanObj, expression: (typeof EXPRESSIONS)[number], at: number) {
  animateProp(obj, "expr", EXPRESSIONS.indexOf(expression), at, 0, "step");
}

export interface WalkResult {
  end: number;
  steps: number;
}

/** Walk or run to toX. Steps are sized to the distance so feet don't skate. */
export function walkTo(
  obj: StickmanObj,
  toX: number,
  start: number,
  duration?: number,
  style: "walk" | "run" | "sneak" = "walk"
): WalkResult {
  const x0 = valueAt(obj, "x", start);
  const dist = toX - x0;
  if (Math.abs(dist) < 1) return { end: start, steps: 0 };
  const s = Math.abs(obj.scale) || 1;
  const cfg = {
    walk: { amp: 24, speed: 170, strideMul: 1, knee: 38, arm: 22, elbow: 18, torso: 3, bob: 1 },
    run: { amp: 34, speed: 430, strideMul: 1.55, knee: 95, arm: 45, elbow: 85, torso: 14, bob: 0.5 },
    sneak: { amp: 20, speed: 80, strideMul: 1, knee: 55, arm: 8, elbow: 100, torso: 18, bob: 1 },
  }[style];
  const stride = 2 * LEG * Math.sin(cfg.amp * DEG) * s * cfg.strideMul;
  const D = duration && duration > 0 ? duration : Math.abs(dist) / (cfg.speed * s);
  const steps = Math.max(1, Math.round(Math.abs(dist) / stride));
  const stepDur = D / steps;

  setFacing(obj, dist > 0 ? 1 : -1, start);
  animateProp(obj, "x", toX, start, D, "linear");

  const startPose = jointsAt(obj, start);
  for (const name of JOINTS) {
    const keys = obj.tracks[name];
    if (keys) removeKeys(keys, start, start + D + 0.3);
  }

  const crouch = style === "sneak" ? 14 : 0;
  const contactHip = LEG * (1 - Math.cos(cfg.amp * DEG)) * cfg.bob + crouch;
  let prev = start;
  const key = (t: number, j: Partial<Joints>, e: Ease = "linear") => {
    animateJoints(obj, j, prev, t - prev, e);
    prev = t;
  };

  for (let i = 0; i < steps; i++) {
    const front = i % 2 === 0 ? "l" : "r";
    const back = front === "l" ? "r" : "l";
    const tContact = start + (i + 0.5) * stepDur;
    const tPass = start + (i + 1) * stepDur;
    key(
      tContact,
      {
        [`${front}Hip`]: cfg.amp,
        [`${front}Knee`]: style === "run" ? 25 : 4,
        [`${back}Hip`]: -cfg.amp,
        [`${back}Knee`]: style === "run" ? 60 : 10,
        [`${front}Shoulder`]: -cfg.arm,
        [`${back}Shoulder`]: cfg.arm,
        lElbow: cfg.elbow,
        rElbow: cfg.elbow,
        torso: cfg.torso,
        neck: -cfg.torso / 2,
        hipY: contactHip,
      },
      i === 0 ? "easeOut" : "linear"
    );
    key(tPass, {
      [`${front}Hip`]: style === "run" ? -5 : 0,
      [`${front}Knee`]: style === "run" ? 20 : 2,
      [`${back}Hip`]: 12,
      [`${back}Knee`]: cfg.knee,
      [`${front}Shoulder`]: -4,
      [`${back}Shoulder`]: 4,
      lElbow: cfg.elbow,
      rElbow: cfg.elbow,
      torso: cfg.torso,
      neck: -cfg.torso / 2,
      hipY: style === "run" ? -6 : crouch - 1,
    });
  }
  // Settle back into the pose they had before walking (or standing if that was a stride).
  const settle = isWalkingPose(startPose) ? POSES.stand : startPose;
  key(start + D + 0.25, settle, "easeOut");
  return { end: start + D + 0.25, steps };
}

function isWalkingPose(j: Joints) {
  return Math.abs(j.lHip - j.rHip) > 20 || j.hipY > 6;
}

export const ACTIONS = [
  "wave",
  "nod",
  "shakeHead",
  "clap",
  "jump",
  "punch",
  "kick",
  "write",
  "dance",
  "celebrate",
  "bow",
  "shrug",
  "fall",
  "getUp",
  "laugh",
  "talk",
  "lookAround",
  "stomp",
] as const;
export type ActionName = (typeof ACTIONS)[number];

type Frame = { at: number; j?: Partial<Joints>; y?: number; rotation?: number; e?: Ease };

/** Frames are relative times; y is relative to the starting y. Returns end time. */
function playFrames(obj: StickmanObj, start: number, frames: Frame[], speed: number, restore: boolean): number {
  const before = jointsAt(obj, start);
  const y0 = valueAt(obj, "y", start);
  const rot0 = valueAt(obj, "rotation", start);
  const touched = new Set<JointName>();
  let prev = start;
  for (const f of frames) {
    const t = start + f.at * speed;
    const dur = t - prev;
    if (f.j) {
      for (const k of Object.keys(f.j) as JointName[]) touched.add(k);
      animateJoints(obj, f.j, prev, dur, f.e ?? "easeInOut");
    }
    if (f.y !== undefined) animateProp(obj, "y", y0 + f.y * obj.scale, prev, dur, f.e ?? "easeInOut");
    if (f.rotation !== undefined) animateProp(obj, "rotation", f.rotation, prev, dur, f.e ?? "easeInOut");
    prev = t;
  }
  if (restore) {
    const back: Partial<Joints> = {};
    for (const k of touched) back[k] = before[k];
    animateJoints(obj, back, prev, 0.3 * speed);
    if (frames.some((f) => f.y !== undefined)) animateProp(obj, "y", y0, prev, 0.3 * speed);
    if (frames.some((f) => f.rotation !== undefined)) animateProp(obj, "rotation", rot0, prev, 0.3 * speed);
    prev += 0.3 * speed;
  }
  return prev;
}

function repeat(times: number, beat: number, offset: number, make: (i: number) => Partial<Joints>): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < times * 2; i++) out.push({ at: offset + beat * (i + 1), j: make(i) });
  return out;
}

export function naturalDuration(action: ActionName, times = 2): number {
  const probe: StickmanObj = {
    id: "probe",
    name: "",
    type: "stickman",
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    opacity: 1,
    tracks: {},
    color: "#000",
    lineWidth: 5,
    facing: 1,
    pose: { ...STAND },
    expression: "none",
  };
  return playAction(probe, action, 0, { times });
}

/** Play a gesture starting at `start`. Returns the end time. */
export function playAction(
  obj: StickmanObj,
  action: ActionName,
  start: number,
  opts: { times?: number; duration?: number } = {}
): number {
  const times = Math.max(1, Math.min(20, Math.round(opts.times ?? 2)));
  const frames = actionFrames(obj, action, times, start);
  const restore = !["fall", "getUp"].includes(action);
  let speed = 1;
  if (opts.duration && opts.duration > 0) {
    const natural = frames[frames.length - 1].at + (restore ? 0.3 : 0);
    speed = opts.duration / natural;
  }
  return playFrames(obj, start, frames, speed, restore);
}

function actionFrames(obj: StickmanObj, action: ActionName, times: number, start: number): Frame[] {
  const j0 = jointsAt(obj, start);
  switch (action) {
    case "wave":
      return [
        { at: 0.3, j: { rShoulder: 150, rElbow: 15 } },
        ...repeat(times, 0.2, 0.3, (i) => ({ rElbow: i % 2 === 0 ? -30 : 25, rShoulder: i % 2 === 0 ? 145 : 155 })),
      ];
    case "nod":
      return repeat(times, 0.18, 0, (i) => ({ neck: i % 2 === 0 ? 22 : -4 }));
    case "shakeHead":
      return repeat(times, 0.14, 0, (i) => ({ neck: i % 2 === 0 ? -14 : 14, torso: i % 2 === 0 ? -2 : 2 }));
    case "clap":
      return [
        { at: 0.25, j: { lShoulder: 55, lElbow: 35, rShoulder: 95, rElbow: 35 } },
        ...repeat(times, 0.16, 0.25, (i) =>
          i % 2 === 0
            ? { lShoulder: 72, lElbow: 55, rShoulder: 72, rElbow: 55 }
            : { lShoulder: 50, lElbow: 35, rShoulder: 100, rElbow: 35 }
        ),
      ];
    case "jump": {
      const crouch = { hipY: 24, lHip: 38, lKnee: 72, rHip: 32, rKnee: 66, torso: 16, lShoulder: -40, rShoulder: -32, lElbow: 10, rElbow: 10 };
      const frames: Frame[] = [];
      let t = 0;
      for (let i = 0; i < times; i++) {
        frames.push({ at: t + 0.22, j: crouch, y: 0 });
        frames.push({ at: t + 0.5, j: { hipY: -4, lHip: 8, lKnee: 20, rHip: -4, rKnee: 30, torso: 0, lShoulder: -135, rShoulder: 135, lElbow: 0, rElbow: 0 }, y: -95, e: "easeOut" });
        frames.push({ at: t + 0.78, j: { lHip: 14, lKnee: 10, rHip: 4, rKnee: 12 }, y: 0, e: "easeIn" });
        frames.push({ at: t + 0.95, j: crouch, y: 0 });
        t += 0.95;
      }
      return frames;
    }
    case "punch":
      return Array.from({ length: times }).flatMap((_, i) => {
        const o = i * 0.55;
        return [
          { at: o + 0.2, j: { rShoulder: 45, rElbow: 115, lShoulder: 60, lElbow: 110, torso: -6, lHip: -18, rHip: 14 } },
          { at: o + 0.32, j: { rShoulder: 90, rElbow: 0, torso: 10, lShoulder: 40, lElbow: 120 }, e: "easeOut" as Ease },
          { at: o + 0.55, j: { rShoulder: 88, rElbow: 2 } },
        ];
      });
    case "kick":
      return [
        { at: 0.22, j: { rHip: -25, rKnee: 70, torso: -6, lShoulder: 30, rShoulder: -30 } },
        { at: 0.37, j: { rHip: 95, rKnee: 0, torso: -18, lShoulder: -40, rShoulder: 60 }, e: "easeOut" },
        { at: 0.6, j: { rHip: 92, rKnee: 3 } },
      ];
    case "write":
      return [
        { at: 0.3, j: { rShoulder: 115, rElbow: 25, lShoulder: -8, torso: 4 } },
        ...repeat(times * 2, 0.14, 0.3, (i) => ({ rShoulder: i % 2 ? 110 : 122, rElbow: i % 2 ? 35 : 12 })),
      ];
    case "dance":
      return repeat(times * 2, 0.3, 0, (i) =>
        i % 2 === 0
          ? { lShoulder: -140, lElbow: -30, rShoulder: 40, rElbow: 90, lHip: -18, rHip: 22, lKnee: 20, hipY: 8, torso: -8 }
          : { lShoulder: -40, lElbow: -90, rShoulder: 140, rElbow: 30, lHip: -22, rHip: 18, rKnee: 20, hipY: 8, torso: 8 }
      );
    case "celebrate": {
      const up = { lShoulder: -135, lElbow: -10, rShoulder: 135, rElbow: 10 };
      const frames: Frame[] = [{ at: 0.2, j: up }];
      for (let i = 0; i < times; i++) {
        frames.push({ at: 0.2 + i * 0.5 + 0.25, j: { hipY: -2, lKnee: 10, rKnee: 10 }, y: -40, e: "easeOut" });
        frames.push({ at: 0.2 + i * 0.5 + 0.5, j: { hipY: 10, lKnee: 20, rKnee: 20 }, y: 0, e: "easeIn" });
      }
      return frames;
    }
    case "bow":
      return [
        { at: 0.5, j: { torso: 60, neck: 18, lShoulder: 55, rShoulder: 65, lElbow: 0, rElbow: 0 } },
        { at: 0.5 + 0.4 * times, j: { torso: 60 } },
      ];
    case "shrug":
      return [
        { at: 0.25, j: POSES.shrug },
        { at: 0.25 + 0.5 * times, j: { neck: -8 } },
      ];
    case "fall": {
      const dir = valueAt(obj, "facing", start) < 0 ? 1 : -1;
      return [
        { at: 0.2, j: { torso: -20, lShoulder: -60, rShoulder: 70, lElbow: 40, rElbow: 40, lKnee: 20, rKnee: 10, neck: 10 } },
        { at: 0.65, j: { torso: 0, lShoulder: -150, rShoulder: 160, lKnee: 0, rKnee: 5, hipY: 0, neck: 0 }, rotation: (valueAt(obj, "rotation", start) + dir * 90), e: "easeIn" },
      ];
    }
    case "getUp":
      return [
        { at: 0.5, j: { ...POSES.crouch }, rotation: 0 },
        { at: 1.0, j: { ...POSES.stand } },
      ];
    case "laugh":
      return [
        { at: 0.2, j: { torso: -12, neck: -20, lShoulder: 30, lElbow: 90, rShoulder: 35, rElbow: 90 } },
        ...repeat(times * 2, 0.12, 0.2, (i) => ({ torso: i % 2 ? -12 : -6, neck: i % 2 ? -22 : -12, hipY: i % 2 ? 0 : 3 })),
      ];
    case "talk":
      return repeat(times * 2, 0.35, 0, (i) =>
        i % 2 === 0
          ? { rShoulder: 45, rElbow: 60, neck: 4, lShoulder: j0.lShoulder }
          : { rShoulder: 30, rElbow: 35, neck: -3, lShoulder: j0.lShoulder + 10 }
      );
    case "lookAround":
      return repeat(times, 0.45, 0, (i) => ({ neck: i % 2 === 0 ? -22 : 20, torso: i % 2 === 0 ? -4 : 4 }));
    case "stomp":
      return repeat(times, 0.22, 0, (i) =>
        i % 2 === 0 ? { rHip: 35, rKnee: 70, lShoulder: -30, rShoulder: -30, lElbow: 60, rElbow: -60 } : { rHip: 5, rKnee: 0, hipY: 4 }
      );
  }
}

export { BONES };
