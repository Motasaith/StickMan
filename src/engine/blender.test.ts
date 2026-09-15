import { describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { applyOps } from "./ops";
import { arrangeBubbles, objectBounds } from "./render";
import { emptyScene, findObj, type BubbleObj } from "./scene";
import { camera3dAt } from "./tracks";
import { PROP_KINDS, buildProp } from "./props";
import { lintScene } from "./lint";

const build = (ops: unknown[]) => {
  const out = applyOps(emptyScene(), ops);
  const bad = out.results.filter((r) => !r.ok);
  if (bad.length) throw new Error(bad.map((b) => b.message).join("; "));
  return out.scene;
};

describe("3D props", () => {
  it("builds every prop kind from parts that stand on the floor", () => {
    for (const kind of PROP_KINDS) {
      const scene = build([{ op: "scene", mode: "3d" }, { op: "prop", id: "p", kind, x: 600 }]);
      const b = objectBounds(undefined, scene, findObj(scene, "p")!, 0);
      expect(b.h, kind).toBeGreaterThan(0);
      // Nothing sinks below the floor. Flat things (rugs, roads) lie on it; clouds float.
      expect(b.y + b.h, kind).toBeLessThanOrEqual(scene.ground + 3);
    }
  });

  it("makes a real 3D house: solid walls and a roof, not flat shapes", () => {
    const parts = buildProp("house", {});
    expect(parts.some((p) => p.kind === "box3")).toBe(true);
    expect(parts.some((p) => p.kind === "prism3")).toBe(true);
    expect(parts.some((p) => p.kind === "rect" || p.kind === "poly")).toBe(false);
  });

  it("lights lamps at night with a real light that follows the prop", () => {
    const scene = build([
      { op: "scene", mode: "3d", lighting: "night" },
      { op: "prop", id: "lamp", kind: "lamp", x: 400, z: -100 },
      { op: "move", id: "lamp", x: 700, at: 1, duration: 1 },
    ]);
    const light = findObj(scene, "lamp_light");
    expect(light?.type).toBe("light");
    expect(buildProp("lamp", { lit: true }).some((p) => "glow" in p && p.glow)).toBe(true);
    const day = build([{ op: "prop", id: "lamp", kind: "lamp", x: 400 }]);
    expect(findObj(day, "lamp_light")).toBeUndefined();
  });

  it("lets a character sit on a solid chair", () => {
    const scene = build([
      { op: "scene", mode: "3d" },
      { op: "prop", id: "chair", kind: "chair", x: 500 },
      { op: "character", id: "bob", x: 300 },
      { op: "pose", id: "bob", pose: "sit", on: "chair", at: 0 },
    ]);
    expect(lintScene(scene).filter((w) => w.includes("sits on nothing"))).toEqual([]);
  });

  it("warns when a 3D scene gets flat drawn furniture", () => {
    const ops = [
      { op: "scene", mode: "3d" },
      { op: "draw", id: "house", x: 300, y: 380, parts: [{ kind: "rect", x: 0, y: 0, w: 260, h: 220, fill: "#eee" }] },
    ];
    const out = applyOps(emptyScene(), ops);
    expect(lintScene(out.scene, out.applied).some((w) => w.includes("paper cutout"))).toBe(true);
  });
});

describe("lighting and lights", () => {
  it("sets lighting and look on the scene and adds light objects", () => {
    const scene = build([
      { op: "scene", mode: "3d", lighting: "golden", look3d: "toon" },
      { op: "light", id: "glow", x: 300, y: 400, color: "#ff8800", intensity: 2 },
    ]);
    expect(scene.lighting).toBe("golden");
    expect(scene.look3d).toBe("toon");
    const l = findObj(scene, "glow");
    expect(l?.type === "light" && l.intensity).toBe(2);
    expect(applyOps(scene, [{ op: "scene", lighting: "sunrise" }]).results[0].ok).toBe(false);
  });
});

describe("director", () => {
  const talk = () =>
    build([
      { op: "scene", mode: "3d", duration: 12 },
      { op: "prop", id: "tree", kind: "tree", x: 200, z: -400 },
      { op: "character", id: "bob", x: 400 },
      { op: "character", id: "amy", x: 800 },
      { op: "walk", id: "bob", to: "amy", at: 0.5 },
      { op: "say", character: "bob", text: "Hi Amy!", at: 4, duration: 2 },
      { op: "say", character: "amy", text: "Hello Bob, nice day.", at: 6.5, duration: 2 },
    ]);

  it("frames a close-up near the target and a wide shot further away", () => {
    const close = build([{ op: "character", id: "bob", x: 400 }, { op: "shot", kind: "medium", target: "bob", at: 0, duration: 2 }]);
    const wide = build([{ op: "character", id: "bob", x: 400 }, { op: "shot", kind: "wide", at: 0, duration: 2 }]);
    const c = camera3dAt(close, 2);
    const w = camera3dAt(wide, 2);
    expect(c.dist).toBeLessThan(w.dist);
    expect(c.tx).toBeCloseTo(400, -2);
    // A close-up looks at the head, well above the floor.
    expect(c.ty).toBeGreaterThan(100);
  });

  it("plans a moving camera for the whole film", () => {
    const scene = talk();
    const out = applyOps(scene, [{ op: "direct" }]);
    expect(out.results[0].ok).toBe(true);
    const cam = out.scene.camera3d!;
    expect(Object.keys(cam.tracks).length).toBeGreaterThan(3);
    const samples = [0, 3, 5, 7.5, 11.5].map((t) => camera3dAt(out.scene, t));
    const distinct = new Set(samples.map((s) => `${Math.round(s.dist / 50)}|${Math.round(s.yaw / 5)}|${Math.round(s.tx / 50)}`));
    expect(distinct.size).toBeGreaterThanOrEqual(3);
    // Directing twice gives the same result instead of piling up keys.
    const again = applyOps(out.scene, [{ op: "direct" }]).scene;
    expect(again.camera3d!.tracks.dist!.length).toBe(cam.tracks.dist!.length);
  });
});

describe("camera around props", () => {
  const camPos = (c: ReturnType<typeof camera3dAt>) => {
    const y = (c.yaw * Math.PI) / 180;
    const p = (c.pitch * Math.PI) / 180;
    return { x: c.tx + Math.sin(y) * Math.cos(p) * c.dist, z: c.tz + Math.cos(y) * Math.cos(p) * c.dist };
  };

  it("does not put a tree between the camera and the actor", () => {
    const plain = build([{ op: "character", id: "bob", x: 600 }, { op: "shot", kind: "medium", target: "bob", at: 0, duration: 2 }]);
    const c0 = camera3dAt(plain, 0.8);
    const cam = camPos(c0);
    // Plant a big tree halfway along the camera's line of sight.
    const scene = build([
      { op: "character", id: "bob", x: 600 },
      { op: "prop", id: "tree", kind: "tree", x: Math.round((cam.x + 600) / 2), z: Math.round(cam.z / 2), scale: 1 },
      { op: "shot", kind: "medium", target: "bob", at: 0, duration: 2 },
    ]);
    const c = camera3dAt(scene, 0.8);
    expect(Math.abs(c.yaw - c0.yaw) > 5 || c.dist < c0.dist * 0.9 || c.pitch > c0.pitch + 10).toBe(true);
  });

  it("directs only the part of the film after the AI's own shots", () => {
    const scene = build([
      { op: "scene", mode: "3d", duration: 12 },
      { op: "character", id: "bob", x: 400 },
      { op: "character", id: "amy", x: 800 },
      { op: "shot", kind: "topDown", at: 0, duration: 4 },
      { op: "say", character: "amy", text: "Hello Bob, nice day.", at: 7, duration: 2 },
    ]);
    const before = camera3dAt(scene, 3.5);
    const out = applyOps(scene, [{ op: "direct", from: 4 }]).scene;
    expect(camera3dAt(out, 3.5).pitch).toBeCloseTo(before.pitch, 3);
    expect(camera3dAt(out, 8).pitch).toBeLessThan(40);
  });
});

describe("speech bubbles", () => {
  it("stacks bubbles that are on screen together so none covers another", () => {
    const scene = build([
      { op: "character", id: "bob", x: 600 },
      { op: "character", id: "amy", x: 680 },
      { op: "say", character: "bob", text: "This is a fairly long line of dialogue", at: 0, duration: 4 },
      { op: "say", character: "amy", text: "And this one overlaps it completely", at: 0, duration: 4 },
    ]);
    const ctx = createCanvas(scene.width, scene.height).getContext("2d") as unknown as CanvasRenderingContext2D;
    const layouts = [...arrangeBubbles(ctx, scene, 2, () => undefined).values()];
    expect(layouts.length).toBe(2);
    const [a, b] = layouts.map((l) => l.box);
    const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    expect(overlap).toBe(false);
  });

  it("does not show an empty bubble before typing starts", () => {
    const scene = build([
      { op: "character", id: "bob", x: 600 },
      { op: "say", character: "bob", text: "Hello there", at: 1, duration: 3 },
    ]);
    const bubble = scene.objects.find((o): o is BubbleObj => o.type === "bubble")!;
    const ctx = createCanvas(scene.width, scene.height).getContext("2d") as unknown as CanvasRenderingContext2D;
    expect(arrangeBubbles(ctx, scene, 0.5, () => undefined).has(bubble.id)).toBe(false);
    expect(arrangeBubbles(ctx, scene, 3, () => undefined).has(bubble.id)).toBe(true);
  });
});
