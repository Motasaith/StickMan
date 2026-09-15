import { describe, expect, it } from "vitest";
import { applyOps } from "./ops";
import { objectBounds, partBounds } from "./render";
import { emptyScene, findObj } from "./scene";
import { camera3dAt, camera3dBase, valueAt } from "./tracks";

const build = (ops: unknown[]) => {
  const out = applyOps(emptyScene(), ops);
  const bad = out.results.filter((r) => !r.ok);
  if (bad.length) throw new Error(bad.map((b) => b.message).join("; "));
  return out.scene;
};

describe("3D scenes", () => {
  it("switches mode and floor, and keeps depth given on create ops", () => {
    const scene = build([
      { op: "scene", mode: "3d", floor: "#ccddaa" },
      { op: "character", id: "bob", x: 300, z: 200 },
      { op: "draw", id: "table", x: 500, y: 600, z: -150, depth: 90, parts: [{ kind: "box3", x: -50, y: -60, w: 100, h: 60, d: 80 }] },
    ]);
    expect(scene.mode).toBe("3d");
    expect(scene.floor).toBe("#ccddaa");
    expect(valueAt(findObj(scene, "bob")!, "z", 3)).toBe(200);
    const table = findObj(scene, "table")!;
    expect(valueAt(table, "z", 0)).toBe(-150);
    expect(table.type === "drawing" && table.depth).toBe(90);
  });

  it("walks through depth, ending at the target and heading that way", () => {
    const scene = build([
      { op: "character", id: "bob", x: 200 },
      { op: "walk", id: "bob", x: 500, z: 400, at: 0 },
    ]);
    const bob = findObj(scene, "bob")!;
    const end = scene.duration;
    expect(valueAt(bob, "x", end)).toBeCloseTo(500, 0);
    expect(valueAt(bob, "z", end)).toBeCloseTo(400, 0);
    expect(valueAt(bob, "yaw", end)).toBeCloseTo((Math.atan2(400, 300) * 180) / Math.PI, 0);
    expect(valueAt(bob, "facing", end)).toBe(1);
    expect(bob.tracks.lHip?.length).toBeGreaterThan(4);
  });

  it("walking back and away faces left in 2D while turning correctly in 3D", () => {
    const scene = build([
      { op: "character", id: "bob", x: 800 },
      { op: "walk", id: "bob", x: 500, z: -300, at: 0 },
    ]);
    const bob = findObj(scene, "bob")!;
    const end = scene.duration;
    expect(valueAt(bob, "facing", end)).toBe(-1);
    // Heading = yaw + 180 for a left-facing character: pointing along (-300, -300).
    const heading = valueAt(bob, "yaw", end) + 180;
    expect(Math.cos((heading * Math.PI) / 180)).toBeCloseTo(-Math.SQRT1_2, 2);
    expect(Math.sin((heading * Math.PI) / 180)).toBeCloseTo(-Math.SQRT1_2, 2);
  });

  it("camera3d and orbit animate from the default camera", () => {
    const scene = build([
      { op: "camera3d", yaw: 40, pitch: 25, distance: 1500, at: 1, duration: 2 },
      { op: "orbit", degrees: 90, at: 4, duration: 3 },
    ]);
    expect(camera3dAt(scene, 0).yaw).toBe(0);
    expect(camera3dAt(scene, 0).dist).toBeCloseTo(camera3dBase(scene, "dist"), 3);
    expect(camera3dAt(scene, 3).yaw).toBeCloseTo(40, 3);
    expect(camera3dAt(scene, 3).dist).toBeCloseTo(1500, 3);
    expect(camera3dAt(scene, 8).yaw).toBeCloseTo(130, 3);
  });

  it("turn rotates in place", () => {
    const scene = build([{ op: "character", id: "bob", x: 300 }, { op: "turn", id: "bob", yaw: 90, at: 1, duration: 0.5 }]);
    const bob = findObj(scene, "bob")!;
    expect(valueAt(bob, "yaw", 0.5)).toBe(0);
    expect(valueAt(bob, "yaw", 2)).toBe(90);
    expect(valueAt(bob, "x", 2)).toBe(300);
  });

  it("solid shapes use top-left like rect and have front-view bounds", () => {
    expect(partBounds({ kind: "box3", x: 60, y: 460, w: 80, h: 40, d: 60, width: 0 })).toEqual({ x: 60, y: 460, w: 80, h: 40 });
    expect(partBounds({ kind: "cylinder3", cx: 0, y: -50, r: 10, h: 50, width: 0 })).toEqual({ x: -10, y: -50, w: 20, h: 50 });
    const scene = build([{ op: "draw", id: "tree", x: 600, y: 619, parts: [{ kind: "cone3", cx: 0, y: -120, r: 40, h: 120 }] }]);
    const b = objectBounds(undefined, scene, findObj(scene, "tree")!, 0);
    expect(b.y + b.h).toBeCloseTo(619 + 1.5, 0);
  });
});

describe("sound effects", () => {
  it("adds sounds that last their length, ambience to the end of the scene", () => {
    const scene = build([
      { op: "scene", duration: 10 },
      { op: "sound", kind: "boing", at: 2 },
      { op: "sound", kind: "rain", at: 1 },
    ]);
    const sounds = scene.objects.filter((o) => o.type === "sound");
    expect(sounds).toHaveLength(2);
    const rain = sounds.find((o) => o.type === "sound" && o.kind === "rain");
    expect(rain?.type === "sound" && rain.duration).toBe(9);
  });

  it("rejects unknown sounds and draws nothing for sounds", () => {
    const out = applyOps(emptyScene(), [{ op: "sound", kind: "explosion", at: 0 }]);
    expect(out.results[0].ok).toBe(false);
    const scene = build([{ op: "sound", id: "s1", kind: "pop", at: 0 }]);
    expect(objectBounds(undefined, scene, findObj(scene, "s1")!, 0).w).toBe(0);
  });
});

describe("3D mistakes caught before they reach the user", () => {
  it("flags furniture and characters floating above the floor", async () => {
    const { lintScene } = await import("./lint");
    const scene = build([
      { op: "draw", id: "bench", x: 500, y: 0, parts: [{ kind: "box3", x: -80, y: -20, w: 160, h: 20, d: 40 }] },
      { op: "character", id: "bob", x: 300, y: 100 },
      { op: "draw", id: "sign", x: 600, y: 100, parts: [{ kind: "rect", x: 0, y: 0, w: 100, h: 50 }] },
    ]);
    const w = lintScene(scene).join("\n");
    expect(w).toMatch(/"bench" floats/);
    expect(w).toMatch(/"bob" floats/);
    expect(w).not.toMatch(/"sign" floats/);
  });

  it("refuses an anchor that isn't on the parent", () => {
    const out = applyOps(emptyScene(), [
      { op: "creature", id: "dog", species: "dog", x: 400 },
      { op: "draw", id: "ball", x: 500, y: 600, parts: [{ kind: "sphere3", cx: 0, cy: 0, r: 10 }] },
      { op: "attach", id: "dog", to: "ball", anchor: "mouth", at: 1 },
      { op: "attach", id: "ball", to: "dog", anchor: "mouth", at: 1 },
    ]);
    expect(out.results[2].ok).toBe(false);
    expect(out.results[2].message).toMatch(/has no anchor "mouth"/);
    expect(out.results[3].ok).toBe(true);
  });
});

describe("3D collisions", () => {
  it("flags a character inside a solid prop only when they share depth", async () => {
    const { lintScene } = await import("./lint");
    const tree = { op: "draw", id: "tree", x: 400, y: 619, parts: [{ kind: "cylinder3", cx: 0, y: -150, r: 16, h: 150 }, { kind: "sphere3", cx: 0, cy: -200, r: 70 }] };
    const inside = build([{ op: "scene", mode: "3d" }, tree, { op: "character", id: "boy", x: 400 }]);
    expect(lintScene(inside).join()).toMatch(/"boy" is inside "tree"/);
    const behind = build([{ op: "scene", mode: "3d" }, tree, { op: "character", id: "boy", x: 400, z: 250 }]);
    expect(lintScene(behind).join()).not.toMatch(/stands inside/);
  });
});
