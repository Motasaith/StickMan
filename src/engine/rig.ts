// The stick man: a circle for the head, lines for everything else.
//
// Local space faces right, origin at the ground between the feet, y down.
// Limb angles are degrees from straight down, positive swings toward the facing
// direction. Torso and neck are degrees from straight up, positive leans forward.
// Shoulders and hips are absolute; elbows and knees bend relative to their parent.

import type { Joints, JointName, StickmanObj } from "./scene";
import { JOINTS } from "./scene";
import { valueAt } from "./tracks";

export const BONES = {
  thigh: 44,
  shin: 44,
  torso: 62,
  neck: 9,
  head: 16,
  upperArm: 36,
  forearm: 34,
};
export const LEG = BONES.thigh + BONES.shin;
/** Ground to top of head when standing, at scale 1. */
export const HEIGHT = LEG + BONES.torso + BONES.neck + BONES.head * 2;

const DEG = Math.PI / 180;

export interface Pt {
  x: number;
  y: number;
}

export interface RigPoints {
  hip: Pt;
  neck: Pt;
  head: Pt;
  headR: number;
  lElbow: Pt;
  lHand: Pt;
  rElbow: Pt;
  rHand: Pt;
  lKnee: Pt;
  lFoot: Pt;
  rKnee: Pt;
  rFoot: Pt;
}

const limb = (p: Pt, angle: number, len: number): Pt => ({
  x: p.x + Math.sin(angle * DEG) * len,
  y: p.y + Math.cos(angle * DEG) * len,
});

export function solveRig(j: Joints): RigPoints {
  const hip = { x: 0, y: -LEG + j.hipY };
  const neck = { x: hip.x + Math.sin(j.torso * DEG) * BONES.torso, y: hip.y - Math.cos(j.torso * DEG) * BONES.torso };
  const headAngle = j.torso + j.neck;
  const headDist = BONES.neck + BONES.head;
  const head = { x: neck.x + Math.sin(headAngle * DEG) * headDist, y: neck.y - Math.cos(headAngle * DEG) * headDist };
  const shoulder = neck;
  const lElbow = limb(shoulder, j.lShoulder, BONES.upperArm);
  const lHand = limb(lElbow, j.lShoulder + j.lElbow, BONES.forearm);
  const rElbow = limb(shoulder, j.rShoulder, BONES.upperArm);
  const rHand = limb(rElbow, j.rShoulder + j.rElbow, BONES.forearm);
  const lKnee = limb(hip, j.lHip, BONES.thigh);
  const lFoot = limb(lKnee, j.lHip - j.lKnee, BONES.shin);
  const rKnee = limb(hip, j.rHip, BONES.thigh);
  const rFoot = limb(rKnee, j.rHip - j.rKnee, BONES.shin);
  return { hip, neck, head, headR: BONES.head, lElbow, lHand, rElbow, rHand, lKnee, lFoot, rKnee, rFoot };
}

export function jointsAt(obj: StickmanObj, t: number): Joints {
  const out = {} as Joints;
  for (const name of JOINTS) out[name] = valueAt(obj, name, t);
  return out;
}

/** Whole-body pose: anything not given comes from standing. */
const P = (j: Partial<Joints>): Joints => ({ ...STAND, ...j });

export const STAND: Joints = {
  torso: 0,
  neck: 0,
  lShoulder: -16,
  lElbow: 6,
  rShoulder: 16,
  rElbow: 6,
  lHip: -5,
  lKnee: 0,
  rHip: 5,
  rKnee: 0,
  hipY: 0,
};

// Whole-body poses set the legs too; upper-body poses leave the legs alone,
// so "point" or "lookUp" while sitting keeps the character seated.
export const POSES = {
  stand: STAND,
  sit: P({ torso: -4, lHip: 85, lKnee: 85, rHip: 90, rKnee: 90, hipY: 44, lShoulder: 30, lElbow: 45, rShoulder: 36, rElbow: 45 }),
  sitFloor: P({ torso: -8, lHip: 88, lKnee: 0, rHip: 92, rKnee: 5, hipY: 86, lShoulder: -25, lElbow: 0, rShoulder: -20, rElbow: 0 }),
  crouch: P({ torso: 20, lHip: 45, lKnee: 95, rHip: 55, rKnee: 100, hipY: 30, lShoulder: 35, lElbow: 30, rShoulder: 45, rElbow: 30 }),
  scared: P({ torso: -10, lShoulder: 30, lElbow: 120, rShoulder: 45, rElbow: 115, lHip: -12, rHip: 14, lKnee: 0, rKnee: 18, hipY: 3 }),
  armsDown: { torso: 0, neck: 0, lShoulder: -16, lElbow: 6, rShoulder: 16, rElbow: 6 },
  armsUp: { lShoulder: -135, lElbow: -5, rShoulder: 135, rElbow: 5, neck: -8 },
  armsOut: { lShoulder: -90, lElbow: 0, rShoulder: 90, rElbow: 0 },
  point: { rShoulder: 90, rElbow: 0, lShoulder: -8, lElbow: 6 },
  reachUp: { rShoulder: 150, rElbow: 5, neck: -15 },
  think: { rShoulder: 18, rElbow: 162, neck: 10, lShoulder: 20, lElbow: 80 },
  handsOnHips: { lShoulder: -35, lElbow: 70, rShoulder: 35, rElbow: -70 },
  holdOut: { lShoulder: 75, lElbow: 15, rShoulder: 85, rElbow: 15 },
  sad: { torso: 8, neck: 28, lShoulder: -3, lElbow: 0, rShoulder: 3, rElbow: 0 },
  lookUp: { neck: -30, torso: -5 },
  lookDown: { neck: 30, torso: 4 },
  facepalm: { neck: 12, rShoulder: 40, rElbow: 140 },
  shrug: { lShoulder: -40, lElbow: -95, rShoulder: 40, rElbow: 95, neck: -6 },
} satisfies Record<string, Partial<Joints>>;

export type PoseName = keyof typeof POSES;
export const POSE_NAMES = Object.keys(POSES) as PoseName[];
export const FULL_BODY_POSES: readonly PoseName[] = ["stand", "sit", "sitFloor", "crouch", "scared"];

/**
 * Two-bone IK. Returns the absolute root angle and relative bend that put the
 * end of the chain on `target`, picking the bend closest to the current one.
 * Arms bend with +bend (child = root + bend); legs with -bend (child = root - bend).
 */
export function solveTwoBone(
  root: Pt,
  target: Pt,
  a: number,
  b: number,
  bendSign: 1 | -1,
  currentBend: number
): { root: number; bend: number } {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(a - b) + 0.01), a + b - 0.01);
  const toTarget = Math.atan2(dx, dy) / DEG;
  const alpha = Math.acos(Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)))) / DEG;
  const candidates = [toTarget + alpha, toTarget - alpha].map((rootAngle) => {
    const elbow = limb(root, rootAngle, a);
    const childWorld = Math.atan2(target.x - elbow.x, target.y - elbow.y) / DEG;
    let bend = bendSign === 1 ? childWorld - rootAngle : rootAngle - childWorld;
    bend = ((((bend + 180) % 360) + 360) % 360) - 180;
    return { root: rootAngle, bend };
  });
  candidates.sort((p, q) => Math.abs(p.bend - currentBend) - Math.abs(q.bend - currentBend));
  return candidates[0];
}

export type Handle = "head" | "lHand" | "rHand" | "lFoot" | "rFoot" | "lElbow" | "rElbow" | "lKnee" | "rKnee";

/** Pose the rig so a handle lands on a local-space point. Returns the joints that changed. */
export function dragHandle(j: Joints, handle: Handle, p: Pt): Partial<Joints> {
  const pts = solveRig(j);
  switch (handle) {
    case "head": {
      const torso = Math.atan2(p.x - pts.hip.x, -(p.y - pts.hip.y)) / DEG;
      return { torso: clampAngle(torso, 100) };
    }
    case "lHand":
    case "rHand": {
      const side = handle[0] as "l" | "r";
      const cur = j[`${side}Elbow` as JointName];
      const r = solveTwoBone(pts.neck, p, BONES.upperArm, BONES.forearm, 1, cur);
      return { [`${side}Shoulder`]: r.root, [`${side}Elbow`]: r.bend };
    }
    case "lFoot":
    case "rFoot": {
      const side = handle[0] as "l" | "r";
      const cur = j[`${side}Knee` as JointName];
      const r = solveTwoBone(pts.hip, p, BONES.thigh, BONES.shin, -1, cur);
      return { [`${side}Hip`]: r.root, [`${side}Knee`]: r.bend };
    }
    case "lElbow":
    case "rElbow": {
      const side = handle[0];
      const a = Math.atan2(p.x - pts.neck.x, p.y - pts.neck.y) / DEG;
      return { [`${side}Shoulder`]: a };
    }
    case "lKnee":
    case "rKnee": {
      const side = handle[0];
      const a = Math.atan2(p.x - pts.hip.x, p.y - pts.hip.y) / DEG;
      return { [`${side}Hip`]: a };
    }
  }
}

function clampAngle(a: number, max: number) {
  return Math.max(-max, Math.min(max, a));
}
