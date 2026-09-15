import { describe, expect, it } from "vitest";
import { applyOps } from "./ops";
import { lintScene } from "./lint";
import { objectBounds, stickmanPoints, stickmanTransform } from "./render";
import { BONES, dragHandle, solveRig, STAND } from "./rig";
import { emptyScene, findObj, type StickmanObj } from "./scene";
import { animateTrack, sampleKeys, valueAt } from "./tracks";

const build = (ops: unknown[]) => {
  const out = applyOps(emptyScene(), ops);
  const bad = out.results.filter((r) => !r.ok);
  if (bad.length) throw new Error(bad.map((b) => b.message).join("; "));
  return out.scene;
};
const man = (scene: ReturnType<typeof build>, id: string) => findObj(scene, id) as StickmanObj;

describe("keyframes", () => {
  it("holds the old value until an animation starts, then eases to the new one", () => {
    const tracks = {};
    animateTrack(tracks, "x", 100, 300, 2, 1);
    const keys = (tracks as Record<string, { t: number; v: number }[]>).x;
    expect(sampleKeys(keys, 0)).toBe(100);
    expect(sampleKeys(keys, 2)).toBe(100);
    expect(sampleKeys(keys, 2.5)).toBeCloseTo(200);
    expect(sampleKeys(keys, 9)).toBe(300);
  });

  it("a zero-length change jumps exactly at its time", () => {
    const tracks = {};
    animateTrack(tracks, "facing", 1, -1, 3, 0, "step");
    const keys = (tracks as Record<string, { t: number; v: number }[]>).facing;
    expect(sampleKeys(keys, 2.99)).toBe(1);
    expect(sampleKeys(keys, 3)).toBe(-1);
  });
});

describe("rig", () => {
  it("stands with feet on the ground", () => {
    const p = solveRig(STAND);
    expect(Math.abs(p.lFoot.y)).toBeLessThan(1);
    expect(Math.abs(p.rFoot.y)).toBeLessThan(1);
  });

  it("IK puts the hand where it was dragged", () => {
    const target = { x: 40, y: -170 };
    const j = { ...STAND, ...dragHandle(STAND, "rHand", target) };
    const hand = solveRig(j).rHand;
    expect(hand.x).toBeCloseTo(target.x, 0);
    expect(hand.y).toBeCloseTo(target.y, 0);
  });

  it("IK clamps unreachable targets to a straight arm", () => {
    const j = { ...STAND, ...dragHandle(STAND, "lHand", { x: 0, y: -1000 }) };
    const p = solveRig(j);
    expect(Math.hypot(p.lHand.x - p.neck.x, p.lHand.y - p.neck.y)).toBeCloseTo(BONES.upperArm + BONES.forearm, 0);
  });
});

describe("ops", () => {
  it("skips invalid ops but keeps the valid ones", () => {
    const out = applyOps(emptyScene(), [
      { op: "character", id: "bob", x: 200 },
      { op: "walk", id: "nobody", x: 10, at: 0 },
      { op: "dance", id: "bob" },
      { op: "action", id: "bob", action: "wave", at: 1 },
    ]);
    expect(out.results.map((r) => r.ok)).toEqual([true, false, false, true]);
    expect(out.applied).toHaveLength(2);
  });

  it("walks to the target, faces the way it walked, and extends the video", () => {
    const scene = build([
      { op: "character", id: "bob", x: 1000, facing: "right" },
      { op: "walk", id: "bob", x: 200, at: 1 },
    ]);
    const bob = man(scene, "bob");
    expect(valueAt(bob, "x", 0.5)).toBe(1000);
    expect(valueAt(bob, "facing", 2)).toBe(-1);
    expect(valueAt(bob, "x", scene.duration)).toBe(200);
    expect(scene.duration).toBeGreaterThan(1 + 800 / 212);
  });

  it("walk to an object stops beside it and faces it", () => {
    const scene = build([
      { op: "draw", id: "box", x: 700, y: 400, parts: [{ kind: "rect", x: 0, y: 0, w: 200, h: 216 }] },
      { op: "character", id: "bob", x: 100 },
      { op: "walk", id: "bob", to: "box", at: 0 },
    ]);
    const bob = man(scene, "bob");
    const end = scene.duration;
    const x = valueAt(bob, "x", end);
    expect(x).toBeLessThan(700);
    expect(x).toBeGreaterThan(640);
    expect(valueAt(bob, "facing", end)).toBe(1);
  });

  it("write places the text inside the board and moves the arm while it appears", () => {
    const scene = build([
      { op: "draw", id: "board", x: 600, y: 150, parts: [{ kind: "rect", x: 0, y: 0, w: 480, h: 260, fill: "#244a30", stroke: "#7a4a1c", width: 12 }] },
      { op: "character", id: "t", x: 200 },
      { op: "write", id: "t", on: "board", text: "E = mc²", at: 0.5 },
    ]);
    const text = findObj(scene, "board_text")!;
    expect(text.type).toBe("text");
    const board = objectBounds(undefined, scene, findObj(scene, "board")!, 0);
    const tb = objectBounds(undefined, scene, text, scene.duration);
    expect(tb.x).toBeGreaterThanOrEqual(board.x);
    expect(tb.x + tb.w).toBeLessThanOrEqual(board.x + board.w);
    expect(tb.y + tb.h).toBeLessThanOrEqual(board.y + board.h);
    if (text.type === "text") expect(text.color).toBe("#f4f4f0");
    const reveal = text.tracks.reveal!;
    const mid = (reveal[0].t + reveal[1].t) / 2;
    const who = man(scene, "t");
    expect(valueAt(who, "rShoulder", mid)).toBeGreaterThan(90);
    const hand = stickmanTransform(who, mid).toWorld(stickmanPoints(who, mid).rHand);
    expect(hand.x).toBeGreaterThan(board.x - 30);
    expect(lintScene(scene)).toEqual([]);
  });

  it("sits on a chair with the hips on the seat, and upper-body poses keep them seated", () => {
    const g = emptyScene().ground;
    const scene = build([
      { op: "draw", id: "chair", x: 500, y: g, parts: [{ kind: "rect", x: 0, y: -55, w: 60, h: 8 }, { kind: "rect", x: 0, y: -47, w: 6, h: 47 }, { kind: "rect", x: 54, y: -47, w: 6, h: 47 }] },
      { op: "character", id: "bob", x: 200 },
      { op: "pose", id: "bob", pose: "sit", on: "chair", at: 0 },
      { op: "pose", id: "bob", pose: "lookUp", at: 4 },
    ]);
    const bob = man(scene, "bob");
    for (const t of [3.9, scene.duration]) {
      const hip = stickmanTransform(bob, t).toWorld(stickmanPoints(bob, t).hip);
      expect(hip.x).toBeCloseTo(530, 0);
      expect(Math.abs(hip.y - (g - 55))).toBeLessThan(6);
    }
    expect(valueAt(bob, "neck", scene.duration)).toBe(-30);
    expect(lintScene(scene)).toEqual([]);
  });

  it("say adds a timed bubble and makes the speaker talk", () => {
    const scene = build([
      { op: "character", id: "bob", x: 300 },
      { op: "say", character: "bob", text: "Hello there", at: 2, duration: 1.5 },
    ]);
    const bubble = scene.objects.find((o) => o.type === "bubble")!;
    expect(valueAt(bubble, "opacity", 1.9)).toBe(0);
    expect(valueAt(bubble, "opacity", 2.5)).toBe(1);
    expect(valueAt(bubble, "opacity", 3.6)).toBe(0);
    expect(man(scene, "bob").tracks.rShoulder?.length).toBeGreaterThan(1);
  });
});

describe("lint", () => {
  it("catches furniture sinking into the floor and sitting on air", () => {
    const g = emptyScene().ground;
    const scene = build([
      { op: "draw", id: "desk", x: 300, y: g - 100, parts: [{ kind: "rect", x: 0, y: 0, w: 200, h: 20 }, { kind: "rect", x: 10, y: 20, w: 15, h: 110 }] },
      { op: "character", id: "sam", x: 900, pose: "sit" },
    ]);
    const warnings = lintScene(scene).join("\n");
    expect(warnings).toMatch(/"desk" reaches down/);
    expect(warnings).toMatch(/"sam" sits on nothing/);
  });
});

describe("editing fixes", () => {
  it("two characters sitting on one bench get separate spots", () => {
    const g = emptyScene().ground;
    const scene = build([
      { op: "draw", id: "bench", x: 500, y: g, parts: [{ kind: "rect", x: 0, y: -55, w: 180, h: 10 }, { kind: "rect", x: 5, y: -45, w: 8, h: 45 }, { kind: "rect", x: 167, y: -45, w: 8, h: 45 }] },
      { op: "character", id: "bob", x: 100 },
      { op: "character", id: "sam", x: 1100 },
      { op: "pose", id: "bob", pose: "sit", on: "bench", at: 0 },
      { op: "pose", id: "sam", pose: "sit", on: "bench", at: 4 },
    ]);
    const end = scene.duration;
    const bx = valueAt(man(scene, "bob"), "x", end);
    const sx = valueAt(man(scene, "sam"), "x", end);
    expect(Math.abs(bx - sx)).toBeGreaterThanOrEqual(60);
    for (const x of [bx, sx]) expect(x).toBeGreaterThan(500);
    for (const x of [bx, sx]) expect(x).toBeLessThan(680);
    expect(lintScene(scene)).toEqual([]);
  });

  it("update x on an animated object moves its whole path", () => {
    const scene = build([
      { op: "character", id: "bob", x: 100 },
      { op: "walk", id: "bob", x: 400, at: 0 },
      { op: "update", id: "bob", set: { x: 150 } },
    ]);
    expect(valueAt(man(scene, "bob"), "x", scene.duration)).toBe(450);
  });

  it("flags a whole-body action done while sitting", () => {
    const out = applyOps(emptyScene(), [
      { op: "character", id: "sam", x: 300, pose: "sit" },
      { op: "action", id: "sam", action: "celebrate", at: 2 },
    ]);
    expect(lintScene(out.scene, out.applied).join()).toMatch(/celebrate at 2s while sitting/);
  });

  it("flags a gesture that starts mid-walk", () => {
    const out = applyOps(emptyScene(), [
      { op: "character", id: "bob", x: 100 },
      { op: "walk", id: "bob", x: 900, at: 0 },
      { op: "action", id: "bob", action: "wave", at: 1 },
    ]);
    expect(lintScene(out.scene, out.applied).join()).toMatch(/while still walking/);
  });
});
