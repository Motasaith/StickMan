import { describe, expect, it } from "vitest";
import { INTROS, OUTROS, addIntro, addOutro } from "./intros";
import { buildFootage, type VideoScript } from "./footage";
import { nicheById } from "./niches";
import { emptyScene, type ImageObj, type SceneObj, type VideoObj } from "./scene";
import { applyOps } from "./ops";

const script: VideoScript = {
  title: "Money",
  hook: "",
  description: "",
  tags: [],
  thumbnailText: "Money",
  niche: "finance",
  format: "16:9",
  checks: [],
  scenes: [
    { id: "a", narration: "Money never sleeps.", visuals: ["city"] },
    { id: "b", narration: "Neither do the people who chase it.", visuals: ["office"] },
  ],
};

const base = () =>
  buildFootage(
    script,
    [
      { narration: { asset: "aud_1", duration: 2, words: [{ text: "Money", start: 0, end: 0.4 }] }, shots: [{ asset: "img_1", kind: "image", w: 1280, h: 720, duration: 0 }] },
      { narration: { asset: "aud_2", duration: 2, words: [{ text: "Neither", start: 0, end: 0.4 }] }, shots: [{ asset: "vid_1", kind: "video", w: 1280, h: 720, duration: 8 }] },
    ],
    { voice: "narrator", style: nicheById("finance").style }
  ).scene;

describe("intros and outros", () => {
  for (const t of INTROS) {
    it(`builds the "${t.id}" intro before everything, pushing the video later`, () => {
      const before = base();
      const { scene, problems } = addIntro(before, t.id, { title: "The Money Trap", subtitle: "Why salaries don't make you rich", channel: "Wealth Lab", accent: "#16A34A" });
      expect(problems).toEqual([]);
      expect(scene.slides![0]).toMatchObject({ id: "intro", start: 0, duration: t.duration });
      expect(scene.slides![1].start).toBeCloseTo(t.duration, 3);
      expect(scene.duration).toBeCloseTo(before.duration + t.duration, 3);
      const mine = scene.objects.filter((o) => o.slide === "intro");
      expect(mine.length).toBeGreaterThan(2);
      // The first picture of the video now appears only after the intro.
      const pic = scene.objects.find((o): o is ImageObj => o.id === "sc1_shot1")!;
      expect(pic.tracks.opacity![1].t).toBeCloseTo(t.duration, 3);
      const clip = scene.objects.find((o): o is VideoObj => o.id === "sc2_shot1")!;
      expect(clip.start).toBeGreaterThan(t.duration);
      // Adding it again replaces it.
      const again = addIntro(scene, t.id, { title: "Other" });
      expect(again.scene.slides!.filter((s) => s.id === "intro").length).toBe(1);
      expect(again.scene.duration).toBeCloseTo(scene.duration, 3);
    });
  }

  for (const t of OUTROS) {
    it(`adds the "${t.id}" outro after the last scene`, () => {
      const before = base();
      const { scene, problems } = addOutro(before, t.id, { title: "Money", channel: "Wealth Lab" });
      expect(problems).toEqual([]);
      const last = scene.slides!.at(-1)!;
      expect(last.id).toBe("outro");
      expect(last.start).toBeCloseTo(before.duration, 3);
      expect(scene.duration).toBeCloseTo(before.duration + t.duration, 3);
      expect(scene.objects.filter((o) => o.slide === "outro").length).toBeGreaterThan(2);
    });
  }

  it("wraps a plain animation into a section before adding an intro", () => {
    const anim = applyOps(emptyScene(), [
      { op: "character", id: "bob", x: 300 },
      { op: "walk", id: "bob", x: 900, at: 0.5 },
    ]).scene;
    const { scene, problems } = addIntro(anim, "minimal", { title: "Bob's walk" });
    expect(problems).toEqual([]);
    const bob = scene.objects.find((o): o is SceneObj => o.id === "bob")!;
    expect(bob.slide).toBe("main");
    expect(scene.slides!.map((s) => s.id)).toEqual(["intro", "main"]);
    const keys = Object.values(bob.tracks).flat();
    expect(Math.min(...keys.map((k) => k.t))).toBeGreaterThanOrEqual(3.6 - 1e-6);
  });

  it("works as ops the AI Director can use", () => {
    const out = applyOps(base(), [
      { op: "intro", template: "neon", title: "Money", channel: "Wealth Lab" },
      { op: "outro", template: "thanks" },
      { op: "intro", template: "nope" },
    ]);
    expect(out.results.map((r) => r.ok)).toEqual([true, true, false]);
    expect(out.scene.slides!.map((s) => s.id)).toEqual(["intro", "sc1", "sc2", "outro"]);
  });
});
