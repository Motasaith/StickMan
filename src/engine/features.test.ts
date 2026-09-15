import { describe, expect, it } from "vitest";
import { applyOps } from "./ops";
import { activeLink, anchorAt, mouthAt, objectBounds, worldState } from "./render";
import { creatureLocalBounds, solveCreature } from "./creatures";
import { emptyScene, findObj, type CreatureObj, type Scene } from "./scene";
import { setAt, valueAt } from "./tracks";

const build = (ops: unknown[], assets: Parameters<typeof applyOps>[2] = []) => {
  const out = applyOps(emptyScene(), ops, assets);
  const bad = out.results.filter((r) => !r.ok);
  if (bad.length) throw new Error(bad.map((b) => b.message).join("; "));
  return out.scene;
};
const G = emptyScene().ground;
const ballOps = [{ op: "draw", id: "ball", x: 700, y: G - 20, parts: [{ kind: "circle", cx: 0, cy: 0, r: 20, fill: "#f00" }] }];

describe("characters and looks", () => {
  it("dresses a character without changing how it moves", () => {
    const scene = build([
      { op: "character", id: "ali", x: 200, look: { hair: "bun", hat: "chef" }, voice: "boy" },
      { op: "walk", id: "ali", x: 600, at: 0 },
    ]);
    const ali = findObj(scene, "ali")!;
    if (ali.type !== "stickman") throw new Error("type");
    expect(ali.look?.style).toBe("cartoon");
    expect(ali.look?.hat).toBe("chef");
    expect(ali.voice).toBe("boy");
    expect(valueAt(ali, "x", scene.duration)).toBe(600);
  });

  it("puppets need an imported picture with joints", () => {
    const joints = Object.fromEntries(["head", "neck", "hip", "lElbow", "lHand", "rElbow", "rHand", "lKnee", "lFoot", "rKnee", "rFoot"].map((k, i) => [k, { x: i, y: i }]));
    const bad = applyOps(emptyScene(), [{ op: "puppet", id: "p", asset: "hero", x: 100 }], [{ id: "a1", name: "hero", w: 10, h: 10 }]);
    expect(bad.results[0].ok).toBe(false);
    const good = applyOps(emptyScene(), [{ op: "puppet", id: "p", asset: "hero", x: 100 }], [{ id: "a1", name: "hero", w: 10, h: 10, joints: joints as never }]);
    expect(good.results[0].ok).toBe(true);
    const p = findObj(good.scene, "p");
    expect(p?.type === "stickman" && p.look?.style).toBe("cutout");
  });
});

describe("animals", () => {
  it("stand with their feet on the ground", () => {
    const scene = build([
      { op: "creature", id: "dog", species: "dog", x: 300 },
      { op: "creature", id: "cat", species: "cat", x: 600 },
      { op: "creature", id: "bird", species: "bird", x: 900 },
    ]);
    for (const id of ["dog", "cat", "bird"]) {
      const b = creatureLocalBounds(findObj(scene, id) as CreatureObj, 0);
      expect(Math.abs(b.y + b.h)).toBeLessThan(8);
    }
  });

  it("walk to a target, face the way they go, and sit or lie without floating", () => {
    const scene = build([
      { op: "creature", id: "rex", species: "dog", x: 900 },
      { op: "walk", id: "rex", x: 300, at: 0 },
      { op: "pose", id: "rex", pose: "sit", at: 4 },
    ]);
    const rex = findObj(scene, "rex") as CreatureObj;
    expect(valueAt(rex, "facing", 1)).toBe(-1);
    expect(valueAt(rex, "x", scene.duration)).toBe(300);
    const b = creatureLocalBounds(rex, scene.duration);
    expect(b.y + b.h).toBeGreaterThan(-6);
    expect(b.y + b.h).toBeLessThan(14);
  });

  it("rejects actions an animal can't do and dog-only poses on people", () => {
    const out = applyOps(emptyScene(), [
      { op: "creature", id: "fish", species: "fish", x: 300, y: 400 },
      { op: "character", id: "bob", x: 600 },
      { op: "action", id: "fish", action: "bark", at: 0 },
      { op: "pose", id: "bob", pose: "lie", at: 0 },
      { op: "action", id: "bob", action: "wagTail", at: 0 },
    ]);
    expect(out.results.map((r) => r.ok)).toEqual([true, true, false, false, false]);
  });

  it("birds fly up and land where asked", () => {
    const scene = build([
      { op: "creature", id: "b", species: "bird", x: 200 },
      { op: "fly", id: "b", x: 900, y: 300, at: 1 },
    ]);
    const b = findObj(scene, "b")!;
    const end = scene.duration;
    expect(valueAt(b, "x", end)).toBeCloseTo(900, 0);
    expect(valueAt(b, "y", end)).toBeCloseTo(300, 0);
    const mid = Math.min(...Array.from({ length: 30 }, (_, i) => valueAt(b, "y", 1 + i * 0.1)));
    expect(mid).toBeLessThan(300);
  });

  it("custom rigs solve bones through their parents", () => {
    const scene = build([
      {
        op: "rig",
        id: "arm",
        x: 400,
        bones: [
          { name: "upper", parent: null, x: 0, y: -100, length: 50, angle: 0 },
          { name: "lower", parent: "upper", x: 50, y: 0, length: 40, angle: 90 },
        ],
      },
      { op: "bones", id: "arm", bones: { upper: 90 }, at: 0, duration: 0 },
    ]);
    const arm = findObj(scene, "arm") as CreatureObj;
    const lower = solveCreature(arm, 1).get("lower")!;
    // upper points down (90°), lower adds another 90° → points left.
    expect(lower.m.e).toBeCloseTo(0, 5);
    expect(lower.m.f).toBeCloseTo(-50, 5);
    expect(lower.angle).toBeCloseTo(180, 5);
  });

  it("a dragged bone on a still animal keeps its new angle", () => {
    const scene = build([{ op: "creature", id: "d", species: "dog", x: 300 }]);
    const d = findObj(scene, "d")!;
    setAt(d, "b.tail", 0, 40);
    expect(valueAt(d, "b.tail", 5)).toBe(40);
  });
});

describe("holding and attaching", () => {
  it("a picked-up ball follows the hand, then falls to the ground when dropped", () => {
    const scene = build([...ballOps, { op: "character", id: "bob", x: 200 }, { op: "hold", id: "bob", item: "ball", at: 0.5 }, { op: "walk", id: "bob", x: 1000, at: 3 }, { op: "drop", id: "ball", at: 8 }]);
    const ball = findObj(scene, "ball")!;
    const bob = findObj(scene, "bob")!;
    expect(activeLink(ball, 5)?.parent).toBe("bob");
    const hand = anchorAt(scene, bob, "rHand", 6);
    const b = objectBounds(undefined, scene, ball, 6);
    expect(Math.hypot(b.x + b.w / 2 - hand.x, b.y + b.h / 2 - hand.y)).toBeLessThan(2);
    expect(activeLink(ball, 8.5)).toBeNull();
    const landed = objectBounds(undefined, scene, ball, scene.duration);
    expect(landed.y + landed.h).toBeCloseTo(G, 0);
  });

  it("attach keeps the object in place, then carries it along", () => {
    const scene = build([
      { op: "draw", id: "car", x: 200, y: G, parts: [{ kind: "rect", x: -80, y: -60, w: 160, h: 60 }] },
      { op: "character", id: "bob", x: 200, y: G - 60 },
      { op: "attach", id: "bob", to: "car", at: 1 },
      { op: "move", id: "car", x: 900, at: 2, duration: 3 },
    ]);
    const bob = findObj(scene, "bob")!;
    expect(worldState(scene, bob, 1.5).x).toBeCloseTo(200, 3);
    expect(worldState(scene, bob, 1.5).y).toBeCloseTo(G - 60, 3);
    expect(worldState(scene, bob, scene.duration).x).toBeCloseTo(900, 3);
  });

  it("refuses attachment loops", () => {
    const out = applyOps(emptyScene(), [
      { op: "draw", id: "a", x: 0, y: 0, parts: [{ kind: "rect", x: 0, y: 0, w: 10, h: 10 }] },
      { op: "draw", id: "b", x: 50, y: 0, parts: [{ kind: "rect", x: 0, y: 0, w: 10, h: 10 }] },
      { op: "attach", id: "a", to: "b", at: 0 },
      { op: "attach", id: "b", to: "a", at: 1 },
    ]);
    expect(out.results[3].ok).toBe(false);
  });
});

describe("effects and motion", () => {
  it("bounces back to where it started, squashing on impact", () => {
    const scene = build([...ballOps, { op: "bounce", id: "ball", at: 1, height: 200, times: 2 }]);
    const ball = findObj(scene, "ball")!;
    const ys = Array.from({ length: 40 }, (_, i) => valueAt(ball, "y", 1 + i * 0.05));
    expect(Math.min(...ys)).toBeLessThan(G - 20 - 150);
    expect(valueAt(ball, "y", scene.duration)).toBeCloseTo(G - 20, 3);
    const squash = Array.from({ length: 60 }, (_, i) => valueAt(ball, "squash", 1 + i * 0.03));
    expect(Math.min(...squash)).toBeLessThan(0.85);
    expect(valueAt(ball, "squash", scene.duration)).toBeCloseTo(1, 3);
  });

  it("follows a path through its points and ends at the last one", () => {
    const scene = build([...ballOps, { op: "path", id: "ball", points: [700, G - 20, 900, 200, 1100, G - 20], at: 0, duration: 2, orient: true }]);
    const ball = findObj(scene, "ball")!;
    expect(valueAt(ball, "x", 2)).toBeCloseTo(1100, 0);
    expect(valueAt(ball, "y", 1)).toBeLessThan(300);
  });

  it("effects cover the canvas by default and fade out at until", () => {
    const scene = build([{ op: "effect", id: "snow", kind: "snow", at: 1, until: 5 }]);
    const fx = findObj(scene, "snow")!;
    expect(fx.type === "effect" && fx.w).toBe(1280);
    expect(valueAt(fx, "opacity", 0.5)).toBe(0);
    expect(valueAt(fx, "opacity", 3)).toBe(1);
    expect(valueAt(fx, "opacity", 6)).toBe(0);
  });

  it("camera shake returns the camera to where it was", () => {
    const scene = build([{ op: "shake", at: 1, duration: 0.5, strength: 20 }]);
    const cam = { tracks: scene.camera.tracks } as never;
    expect(valueAt(cam, "x", 2)).toBeCloseTo(640, 3);
  });
});

describe("voices", () => {
  it("mouths open with the loudness of their voiced line only while it plays", () => {
    const scene: Scene = build([{ op: "character", id: "bob", x: 300 }, { op: "say", character: "bob", text: "Hello", at: 1 }]);
    const bubble = scene.objects.find((o) => o.type === "bubble")!;
    if (bubble.type !== "bubble") throw new Error("type");
    bubble.audio = { asset: "a", at: 1, duration: 1, envelope: Array.from({ length: 30 }, (_, i) => (i % 2 ? 1 : 0)), rate: 30, text: "Hello", voice: "man" };
    expect(mouthAt(scene, "bob", 0.5)).toBe(0);
    const samples = Array.from({ length: 20 }, (_, i) => mouthAt(scene, "bob", 1.01 + i * 0.033));
    expect(Math.max(...samples)).toBeGreaterThan(0.5);
    expect(mouthAt(scene, "bob", 2.5)).toBe(0);
  });

  it("changing a line's text drops its old recording", () => {
    const scene = build([{ op: "character", id: "bob", x: 300 }, { op: "say", id: "line", character: "bob", text: "Hi", at: 0 }]);
    const b = findObj(scene, "line")!;
    if (b.type === "bubble") b.audio = { asset: "a", at: 0, duration: 1, envelope: [], rate: 30, text: "Hi", voice: "man" };
    const out = applyOps(scene, [{ op: "update", id: "line", set: { text: "Hello!" } }]);
    const after = findObj(out.scene, "line")!;
    expect(after.type === "bubble" && after.audio).toBeNull();
  });
});

describe("fixes from the first AI runs", () => {
  it("setting a line to the same words keeps its recording", () => {
    const scene = build([{ op: "character", id: "bob", x: 300 }, { op: "say", id: "line", character: "bob", text: "Good boy!", at: 0 }]);
    const b = findObj(scene, "line")!;
    if (b.type === "bubble") b.audio = { asset: "a", at: 0, duration: 1, envelope: [], rate: 30, text: "Good boy!", voice: "man" };
    const out = applyOps(scene, [{ op: "update", id: "line", set: { text: "Good boy!" } }]);
    const after = findObj(out.scene, "line")!;
    expect(after.type === "bubble" && after.audio?.asset).toBe("a");
  });

  it("attaching to a mouth or hand puts the object in it", () => {
    const scene = build([...ballOps, { op: "creature", id: "rex", species: "dog", x: 400 }, { op: "attach", id: "ball", to: "rex", anchor: "mouth", at: 1 }]);
    const mouth = anchorAt(scene, findObj(scene, "rex")!, "mouth", 2);
    const b = objectBounds(undefined, scene, findObj(scene, "ball")!, 2);
    expect(Math.hypot(b.x + b.w / 2 - mouth.x, b.y + b.h / 2 - mouth.y)).toBeLessThan(2);
  });

  it("flags a dog parked inside its owner", async () => {
    const { lintScene } = await import("./lint");
    const scene = build([{ op: "character", id: "mia", x: 600 }, { op: "creature", id: "spot", species: "dog", x: 610 }]);
    expect(lintScene(scene).join()).toMatch(/"mia" and "spot" stand inside each other/);
    const apart = build([{ op: "character", id: "mia", x: 600 }, { op: "creature", id: "spot", species: "dog", x: 740 }]);
    expect(lintScene(apart).join()).not.toMatch(/inside each other/);
  });
});

describe("walking to things", () => {
  it("stops beside the target on a side nobody else is standing on", () => {
    const scene = build([
      { op: "creature", id: "spot", species: "dog", x: 600 },
      { op: "draw", id: "ball", x: 700, y: G - 20, parts: [{ kind: "circle", cx: 0, cy: 0, r: 20 }] },
      { op: "character", id: "mia", x: 1100 },
      { op: "walk", id: "mia", to: "spot", at: 0 },
    ]);
    const mia = findObj(scene, "mia")!;
    const spot = objectBounds(undefined, scene, findObj(scene, "spot")!, scene.duration);
    const x = valueAt(mia, "x", scene.duration);
    expect(x < spot.x - 10 || x > spot.x + spot.w + 10).toBe(true);
  });

  it("walking to a carried item goes to whoever carries it", () => {
    const scene = build([
      { op: "creature", id: "spot", species: "dog", x: 300 },
      { op: "draw", id: "ball", x: 420, y: G - 20, parts: [{ kind: "circle", cx: 0, cy: 0, r: 20 }] },
      { op: "hold", id: "spot", item: "ball", at: 0 },
      { op: "walk", id: "spot", x: 900, at: 1 },
      { op: "character", id: "mia", x: 100 },
      { op: "walk", id: "mia", to: "ball", at: 6 },
    ]);
    const x = valueAt(findObj(scene, "mia")!, "x", scene.duration);
    const spot = objectBounds(undefined, scene, findObj(scene, "spot")!, scene.duration);
    expect(x).toBeLessThan(spot.x);
    expect(spot.x - x).toBeLessThan(90);
  });
});
