import { describe, expect, it } from "vitest";
import { buildFootage, scriptSeconds, type SceneMedia, type VideoScript } from "./footage";
import { nicheById } from "./niches";
import { applyOps } from "./ops";
import { fitSlidesToNarration } from "./slides";
import { cloneScene } from "./scene";
import type { AudioObj, CaptionObj, ImageObj, VideoObj } from "./scene";

const script: VideoScript = {
  title: "The Fall of Blockbuster",
  hook: "In 2000 they could have bought Netflix for $50 million.",
  description: "",
  tags: [],
  thumbnailText: "They laughed at Netflix",
  niche: "documentary",
  format: "16:9",
  checks: [],
  scenes: [
    { id: "a", chapter: "The Rise", narration: "In 2000, Blockbuster was everywhere. Nine thousand stores.", visuals: ["video rental store"] },
    { id: "b", chapter: "The Rise", narration: "Then a tiny company walked in with an offer.", visuals: ["business meeting"], overlay: { kind: "stat", text: "the asking price", value: 50, prefix: "$", suffix: "M" } },
    { id: "c", chapter: "The Fall", narration: "They laughed them out of the room. Nobody is laughing now.", visuals: ["empty store"], overlay: { kind: "title", text: "The mistake" } },
  ],
};

const words = (text: string, dur: number) => {
  const parts = text.split(" ");
  return parts.map((p, i) => ({ text: p, start: (i * dur) / parts.length, end: ((i + 1) * dur) / parts.length }));
};

const media: SceneMedia[] = [
  { narration: { asset: "aud_1", duration: 4, words: words(script.scenes[0].narration, 4) }, shots: [{ asset: "vid_1", kind: "video", w: 1920, h: 1080, duration: 12 }] },
  { narration: { asset: "aud_2", duration: 3, words: words(script.scenes[1].narration, 3) }, shots: [{ asset: "img_1", kind: "image", w: 1000, h: 1000, duration: 0 }] },
  { narration: null, shots: [] },
];

describe("faceless video builder", () => {
  const { scene, problems } = buildFootage(script, media, { voice: "preset:blend_documentary", style: nicheById("documentary").style });

  it("applies every op", () => {
    expect(problems).toEqual([]);
  });

  it("makes one section per scene, timed to the narration", () => {
    expect(scene.slides?.map((s) => s.id)).toEqual(["sc1", "sc2", "sc3"]);
    const [a, b, c] = scene.slides!;
    expect(a.duration).toBeCloseTo(4.6, 3);
    expect(b.start).toBeCloseTo(4.6, 3);
    expect(b.duration).toBeCloseTo(3.6, 3);
    expect(c.start).toBeCloseTo(8.2, 3);
    expect(scene.duration).toBeCloseTo(c.start + c.duration, 3);
  });

  it("changes chapters with a transition and a marker, cuts inside a chapter", () => {
    const [a, b, c] = scene.slides!;
    expect(a.transition.kind).toBe("cut");
    expect(b.transition.kind).toBe("cut");
    expect(c.transition.kind).toBe("fade");
    expect(scene.markers?.map((m) => m.label)).toEqual(["The Rise", "The Fall"]);
  });

  it("cuts muted, zooming shots across each scene, and the last one plays under the next transition", () => {
    const shots = scene.objects.filter((o): o is VideoObj => o.type === "video" && o.slide === "sc1");
    expect(shots.length).toBe(1);
    expect(shots[0].volume).toBe(0);
    expect(shots[0].crop).toBeNull();
    expect(shots[0].tracks.scale?.length).toBe(2);
    const photo = scene.objects.find((o): o is ImageObj => o.type === "image" && o.slide === "sc2")!;
    // Square picture cropped to 16:9.
    expect(photo.crop!.h).toBeCloseTo(0.5625, 3);
    const lastB = scene.slides![1].start + scene.slides![1].duration;
    const off = photo.tracks.opacity!.at(-1)!;
    expect(off.t).toBeCloseTo(lastB + scene.slides![2].transition.duration, 3);
  });

  it("places narration with word timings on the scene clock, and waits to voice the missing one", () => {
    const voices = scene.objects.filter((o): o is AudioObj => o.type === "audio");
    expect(voices.map((v) => v.asset)).toEqual(["aud_1", "aud_2", null]);
    expect(voices[1].start).toBeCloseTo(4.85, 3);
    expect(voices[1].words![0].start).toBeCloseTo(4.85, 3);
    expect(voices[2].voice).toBe("preset:blend_documentary");
    expect(voices[2].words!.length).toBeGreaterThan(5);
    const cap = scene.objects.find((o): o is CaptionObj => o.type === "caption")!;
    expect(cap.words.length).toBe(voices.reduce((n, v) => n + v.words!.length, 0));
  });

  it("puts on-screen text in its scene", () => {
    expect(scene.objects.find((o) => o.id === "sc2_stat")?.slide).toBe("sc2");
    expect(scene.objects.find((o) => o.id === "sc3_title")?.slide).toBe("sc3");
    expect(scene.objects.find((o) => o.id === "sc3_bell")?.slide).toBe("sc3");
    expect(scene.objects.find((o) => o.id === "sc1_open")?.slide).toBe("sc1");
    expect(scene.grade).toBeTruthy();
  });

  it("estimates the length of an unrecorded script", () => {
    expect(scriptSeconds(script)).toBeGreaterThan(8);
  });

  it("builds vertical shorts at 720x1280", () => {
    const short = buildFootage({ ...script, format: "9:16", scenes: [script.scenes[0]] }, [media[0]], { voice: "woman", style: nicheById("shorts").style });
    expect(short.problems).toEqual([]);
    expect([short.scene.width, short.scene.height]).toEqual([720, 1280]);
    const shot = short.scene.objects.find((o): o is VideoObj => o.type === "video")!;
    expect(shot.crop!.w).toBeCloseTo((720 / 1280) / (1920 / 1080), 3);
    expect(short.scene.objects.find((o) => o.id === "sc1_open")).toBeTruthy();
  });

  it("swaps a shot's footage in place, video to picture and back", () => {
    const assets = [
      { id: "img_9", name: "skyline", w: 1920, h: 1280, kind: "image" as const },
      { id: "vid_9", name: "crowd", w: 1280, h: 720, kind: "video" as const, duration: 2 },
    ];
    const a = applyOps(scene, [{ op: "swapShot", id: "sc1_shot1", asset: "skyline" }], assets);
    expect(a.results[0].ok).toBe(true);
    const pic = a.scene.objects.find((o) => o.id === "sc1_shot1") as ImageObj;
    expect(pic.type).toBe("image");
    expect(pic.slide).toBe("sc1");
    expect(pic.tracks.opacity?.[1].t).toBe(0);
    expect(pic.tracks.opacity?.[2].t).toBeCloseTo(4.6, 3);
    expect(pic.crop!.h).toBeCloseTo(1.5 / (16 / 9), 3);
    const b = applyOps(a.scene, [{ op: "swapShot", id: "sc1_shot1", asset: "vid_9" }], assets);
    const clip = b.scene.objects.find((o) => o.id === "sc1_shot1") as VideoObj;
    expect(clip.type).toBe("video");
    expect(clip.duration).toBeCloseTo(4.6, 3);
    // A 2 second clip stretched over 4.6 seconds plays at the slowest allowed speed.
    expect(clip.speed).toBe(0.5);
    expect(clip.volume).toBe(0);
    const bad = applyOps(scene, [{ op: "swapShot", id: "sc1_voice", asset: "vid_9" }], assets);
    expect(bad.results[0].ok).toBe(false);
  });

  it("fits a scene to re-recorded narration, stretching its shots and moving later scenes", () => {
    const next = cloneScene(scene);
    const voice = next.objects.find((o): o is AudioObj => o.id === "sc1_voice")!;
    voice.duration = 6; // was 4
    fitSlidesToNarration(next);
    const [a, b] = next.slides!;
    expect(a.duration).toBeCloseTo(0.25 + 6 + 0.35, 2);
    expect(b.start).toBeCloseTo(a.duration, 2);
    const shot = next.objects.find((o): o is VideoObj => o.id === "sc1_shot1")!;
    expect(shot.start + shot.duration).toBeCloseTo(a.duration, 2);
    expect(shot.speed).toBeLessThan(1);
    // Shorter again: the scene shrinks back.
    voice.duration = 2;
    fitSlidesToNarration(next);
    expect(next.slides![0].duration).toBeCloseTo(2.6, 2);
    expect(next.duration).toBeCloseTo(next.slides!.at(-1)!.start + next.slides!.at(-1)!.duration, 2);
  });
});
