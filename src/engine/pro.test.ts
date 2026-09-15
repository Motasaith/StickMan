import { describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyOps, type AssetInfo } from "./ops";
import { emptyScene, findObj, type AudioObj, type Scene, type SvgObj, type VideoObj } from "./scene";
import { objectBounds, renderScene } from "./render";
import { captionLineAt, captionLines, estimateWords, videoSourceTime } from "./media";
import { fitSlidesToNarration } from "./slides";
import { counterText } from "./chart";
import { valueAt } from "./tracks";
import { findIllustration } from "./illustrations";

type Ctx = CanvasRenderingContext2D;

const ASSETS: AssetInfo[] = [
  { id: "clip1", name: "beach.mp4", w: 1920, h: 1080, kind: "video", duration: 12, hasAudio: true },
  { id: "tall", name: "phone.mp4", w: 1080, h: 1920, kind: "video", duration: 6, hasAudio: false },
  { id: "vo", name: "voice.webm", w: 0, h: 0, kind: "audio", duration: 8 },
];

const build = (ops: unknown[], scene: Scene = emptyScene()) => {
  const out = applyOps(scene, ops, ASSETS);
  const bad = out.results.filter((r) => !r.ok);
  if (bad.length) throw new Error(bad.map((b) => b.message).join("; "));
  return out;
};

function lookups() {
  return {
    svgs: (src: string) => {
      try {
        if (src.startsWith("emoji:")) return readFileSync(join("public", "stickers", `${src.slice(6)}.svg`), "utf8");
        if (src.startsWith("lib:")) return readFileSync(join("public", "illustrations", `${src.slice(4)}.svg`), "utf8");
      } catch {
        return undefined;
      }
      return undefined;
    },
    makeCanvas: (w: number, h: number) => {
      const c = createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
      return { canvas: c as unknown as CanvasImageSource & { width: number; height: number }, ctx: c.getContext("2d") as unknown as Ctx };
    },
  };
}

function frame(scene: Scene, t: number) {
  const c = createCanvas(scene.width, scene.height);
  const ctx = c.getContext("2d") as unknown as Ctx;
  renderScene(ctx, scene, t, lookups());
  return (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data);
}

describe("stickers and illustrations", () => {
  it("finds stickers by emoji or name and illustrations by topic", () => {
    const { scene } = build([
      { op: "sticker", id: "s1", emoji: "👍", x: 100, y: 100 },
      { op: "sticker", id: "s2", emoji: "fire", x: 300, y: 100, enter: "pop", at: 1, loop: "pulse" },
      { op: "illustration", id: "art", name: "dentist", x: 500, y: 200, w: 300 },
    ]);
    expect((findObj(scene, "s1") as SvgObj).src).toBe("emoji:1f44d");
    expect((findObj(scene, "s2") as SvgObj).src).toBe("emoji:1f525");
    expect((findObj(scene, "art") as SvgObj).src).toMatch(/^lib:(teeth|tooth|toothbrush)$/);
    expect(valueAt(findObj(scene, "s2")!, "opacity", 0.5)).toBe(0);
    expect(valueAt(findObj(scene, "s2")!, "opacity", 2)).toBe(1);
    expect(findIllustration("quarterly sales growth")?.id).toMatch(/barchart|growth|linechart|arrowup/);
  });

  it("explains a missing illustration and suggests drawing one", () => {
    const out = applyOps(emptyScene(), [{ op: "illustration", id: "x", name: "submarine", x: 0, y: 0 }]);
    expect(out.results[0].ok).toBe(false);
    expect(out.results[0].message).toMatch(/op":"svg"/);
  });

  it("keeps an AI-drawn SVG as a new asset and rejects one that draws nothing", () => {
    const out = build([{ op: "svg", id: "sub", name: "Submarine", svg: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#ff0"/></svg>', x: 10, y: 10, w: 200, h: 200 }]);
    expect(out.newAssets[0]).toMatchObject({ id: "svg_sub", kind: "svg" });
    expect((findObj(out.scene, "sub") as SvgObj).src).toBe("asset:svg_sub");
    const bad = applyOps(emptyScene(), [{ op: "svg", id: "b", svg: '<svg viewBox="0 0 10 10"></svg>', x: 0, y: 0, w: 10, h: 10 }]);
    expect(bad.results[0].message).toMatch(/draws nothing/);
  });

  it("draws stickers and illustrations on the canvas", () => {
    const { scene } = build([{ op: "sticker", id: "s", emoji: "red heart", x: 540, y: 260, size: 200 }]);
    const px = frame(scene, 0);
    const [r, g, , a] = px(640, 370);
    expect(a).toBe(255);
    expect(r).toBeGreaterThan(180);
    expect(g).toBeLessThan(120);
  });
});

describe("video and audio clips", () => {
  it("fills the frame with a wider video by cropping its sides", () => {
    const { scene } = build([{ op: "video", id: "v", asset: "tall" }]);
    const v = findObj(scene, "v") as VideoObj;
    expect([v.x, v.y, v.w, v.h]).toEqual([0, 0, 1280, 720]);
    expect(v.crop!.h).toBeLessThan(0.5);
    expect(v.volume).toBe(0);
    expect(scene.duration).toBeGreaterThanOrEqual(6);
  });

  it("maps scene time to source time with trim, speed and reverse", () => {
    const { scene } = build([{ op: "video", id: "v", asset: "clip1", start: 2, in: 3, duration: 4, speed: 2 }]);
    const v = findObj(scene, "v") as VideoObj;
    expect(videoSourceTime(v, 1)).toBeNull();
    expect(videoSourceTime(v, 3)).toBeCloseTo(5);
    v.reverse = true;
    expect(videoSourceTime(v, 2)).toBeCloseTo(11);
  });

  it("splits a clip into two that play on from where the first stopped", () => {
    const { scene } = build([
      { op: "video", id: "v", asset: "clip1", start: 0, duration: 10 },
      { op: "split", id: "v", at: 4 },
    ]);
    const a = findObj(scene, "v") as VideoObj;
    const b = findObj(scene, "v_b") as VideoObj;
    expect(a.duration).toBeCloseTo(4);
    expect([b.start, b.in, b.duration]).toEqual([4, 4, 6]);
    expect(videoSourceTime(b, 5)).toBeCloseTo(videoSourceTime({ ...a, duration: 10 }, 5)!);
  });

  it("detaches a video's sound as its own clip", () => {
    const { scene } = build([{ op: "video", id: "v", asset: "clip1" }, { op: "detachAudio", id: "v" }]);
    expect((findObj(scene, "v") as VideoObj).volume).toBe(0);
    expect(findObj(scene, "v_sound")).toMatchObject({ type: "audio", asset: "clip1", role: "sound" });
  });
});

describe("narration and captions", () => {
  it("times words across the narration and shows them a line at a time", () => {
    const { scene } = build([
      { op: "narrate", id: "n1", text: "Brushing twice a day keeps cavities away. Floss every night before bed.", at: 1, captions: true },
    ]);
    const n = findObj(scene, "n1") as AudioObj;
    expect(n.words!.length).toBe(12);
    expect(n.words![0].start).toBeCloseTo(1);
    const cap = scene.objects.find((o) => o.type === "caption")!;
    expect(cap.type === "caption" && cap.words.length).toBe(12);
    if (cap.type !== "caption") return;
    const lines = captionLines(cap.words, 22);
    expect(lines.length).toBeGreaterThan(1);
    expect(captionLineAt(cap, 0.5)).toBeNull();
    expect(captionLineAt(cap, 1.2)?.words[0].text).toBe("Brushing");
  });

  it("estimates word times in proportion to their length", () => {
    const w = estimateWords("a bbbbbbb", 0, 10);
    expect(w[1].end).toBeCloseTo(10);
    expect(w[0].end - w[0].start).toBeLessThan(w[1].end - w[1].start);
  });
});

describe("presentations", () => {
  const deck = () =>
    build([
      {
        op: "presentation",
        title: "Healthy teeth",
        theme: "medical",
        captions: true,
        slides: [
          { layout: "title", title: "Healthy Smiles", illustration: "teeth", narration: "Welcome to our talk about healthy teeth." },
          { layout: "bullets", title: "Habits", bullets: ["Brush twice a day", "Floss daily"], narration: "Two habits matter most." },
          { layout: "stat", stat: { value: 92, label: "adults had a cavity", suffix: "%" } },
          { layout: "closing", title: "Thanks!" },
        ],
      },
    ]).scene;

  it("lays out slides one after another with narration and captions", () => {
    const scene = deck();
    const slides = scene.slides!;
    expect(slides.map((s) => s.layout)).toEqual(["title", "bullets", "stat", "closing"]);
    for (let i = 1; i < slides.length; i++) expect(slides[i].start).toBeCloseTo(slides[i - 1].start + slides[i - 1].duration);
    expect(slides[0].transition.kind).toBe("cut");
    expect(scene.duration).toBeCloseTo(slides[3].start + slides[3].duration);
    const voices = scene.objects.filter((o) => o.type === "audio" && o.role === "narration");
    expect(voices.length).toBe(2);
    const cap = scene.objects.find((o) => o.type === "caption");
    expect(cap?.type === "caption" && cap.words.length).toBe(11);
    expect(scene.objects.some((o) => o.type === "svg" && o.src === "lib:teeth")).toBe(true);
  });

  it("lengthens a slide when its recorded voice is longer, moving the rest", () => {
    const scene = deck();
    const second = scene.slides![1];
    const third = scene.slides![2];
    const voice = scene.objects.find((o): o is AudioObj => o.type === "audio" && o.slide === second.id)!;
    const statStart = third.start;
    const counter = scene.objects.find((o) => o.type === "text" && o.counter)!;
    const counterStart = counter.type === "text" ? counter.counter!.start : 0;
    const before = second.duration;
    voice.duration += 5;
    const changed = fitSlidesToNarration(scene);
    expect(changed).toEqual([second.id]);
    const moved = scene.slides![2].start - statStart;
    expect(moved).toBeCloseTo(scene.slides![1].duration - before, 5);
    expect(moved).toBeGreaterThan(4);
    expect(counter.type === "text" && counter.counter!.start).toBeCloseTo(counterStart + moved, 5);
  });

  it("removes a slide and closes the gap", () => {
    const { scene } = build([{ op: "removeSlide", id: "slide2" }], deck());
    expect(scene.slides!.map((s) => s.layout)).toEqual(["title", "stat", "closing"]);
    expect(scene.slides![1].start).toBeCloseTo(scene.slides![0].duration);
    expect(scene.objects.some((o) => o.slide === "slide2")).toBe(false);
  });

  it("restyles with another theme and keeps recorded voices", () => {
    const scene = deck();
    const voice = scene.objects.find((o): o is AudioObj => o.type === "audio" && o.slide === "slide1")!;
    voice.asset = "tts_1";
    voice.duration = 3.3;
    const { scene: next } = build([{ op: "theme", theme: "midnight" }], scene);
    expect(next.theme).toBe("midnight");
    expect(next.slides![0].background).toMatchObject({ kind: "gradient", from: "#0B1026" });
    const kept = next.objects.find((o): o is AudioObj => o.type === "audio" && o.slide === "slide1")!;
    expect(kept.asset).toBe("tts_1");
    expect(kept.duration).toBeCloseTo(3.3);
  });

  it("renders a slide, and a transition between two", () => {
    const scene = deck();
    const s2 = scene.slides![1];
    const mid = frame(scene, s2.start + s2.duration - 0.2);
    expect(mid(20, 20).slice(0, 3)).toEqual([242, 251, 251]);
    const cover = frame(scene, scene.slides![0].start + 1);
    expect(cover(20, 20)[2]).toBeGreaterThan(150);
    expect(cover(20, 20)[0]).toBeLessThan(60);
  });

  it("counts numbers up and grows charts over time", () => {
    const c = { from: 0, to: 92, start: 1, duration: 2, decimals: 0, prefix: "", suffix: "%" };
    expect(counterText(c, 0)).toBe("0%");
    expect(counterText(c, 5)).toBe("92%");
    const mid = Number(counterText(c, 2).replace("%", ""));
    expect(mid).toBeGreaterThan(40);
    expect(mid).toBeLessThan(92);
  });
});

describe("regions, loops and entrances", () => {
  it("blurs and redacts the picture under a region", () => {
    const base = build([
      { op: "draw", id: "stripes", x: 0, y: 0, parts: Array.from({ length: 20 }, (_, i) => ({ kind: "rect", x: i * 20, y: 0, w: 10, h: 400, fill: "#000000" })) },
    ]).scene;
    const plain = frame(base, 0);
    expect(plain(105, 100)[0]).toBe(0);
    expect(plain(115, 100)[0]).toBe(255);
    const blurred = frame(build([{ op: "region", id: "r", kind: "blur", x: 60, y: 40, w: 160, h: 160, strength: 12 }], base).scene, 0);
    expect(blurred(105, 100)[0]).toBeGreaterThan(40);
    expect(blurred(105, 100)[0]).toBeLessThan(215);
    const red = frame(build([{ op: "region", id: "r", kind: "redact", x: 60, y: 40, w: 160, h: 160, color: "#ff0000" }], base).scene, 0);
    expect(red(115, 100).slice(0, 3)).toEqual([255, 0, 0]);
  });

  it("pops in around the middle, so the object doesn't jump from its corner", () => {
    const { scene } = build([
      { op: "illustration", id: "a", name: "rocket", x: 400, y: 200, w: 200, enter: "pop", at: 1 },
    ]);
    const a = findObj(scene, "a")!;
    const ctx = createCanvas(10, 10).getContext("2d") as unknown as Ctx;
    const early = objectBounds(ctx, scene, a, 1.1);
    const late = objectBounds(ctx, scene, a, 3);
    expect(early.w).toBeLessThan(late.w);
    expect(early.x + early.w / 2).toBeCloseTo(late.x + late.w / 2, 0);
    expect(early.y + early.h / 2).toBeCloseTo(late.y + late.h / 2, 0);
  });

  it("grades the whole picture", () => {
    const { scene } = build([{ op: "background", color: "#ff0000" }, { op: "grade", look: "noir" }]);
    const px = frame(scene, 0)(10, 10);
    expect(Math.abs(px[0] - px[1])).toBeLessThan(12);
  });
});
