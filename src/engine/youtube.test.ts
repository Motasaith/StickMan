import { describe, expect, it } from "vitest";
import { buildFootage, type SceneMedia, type VideoScript } from "./footage";
import { addIntro } from "./intros";
import { nicheById } from "./niches";
import type { Asset, AudioObj, Word } from "./scene";
import { chaptersText, makeShort, subtitles } from "./youtube";

const said = (text: string, gap = 0.4): Word[] => text.split(" ").map((w, i) => ({ text: w, start: i * gap, end: i * gap + 0.3 }));

const scenes = Array.from({ length: 6 }, (_, i) => ({
  id: `s${i}`,
  chapter: `Part ${Math.floor(i / 2) + 1}`,
  narration: `This is scene number ${i + 1} and it has a few words to say about money today.`,
  visuals: ["city"],
  media: "video" as const,
  overlay: null,
}));
const script: VideoScript = { title: "Money", hook: "", description: "", tags: ["money"], thumbnailText: "MONEY", niche: "finance", format: "16:9", scenes, checks: [] };
const assets: Asset[] = [
  { id: "clip", name: "clip", src: "/c.mp4", w: 1920, h: 1080, kind: "video", duration: 12 },
  ...scenes.map((_, i) => ({ id: `v${i}`, name: `v${i}`, src: `/v${i}.mp3`, w: 0, h: 0, kind: "audio" as const, duration: 6 })),
];
const media: SceneMedia[] = scenes.map((s, i) => ({
  narration: { asset: `v${i}`, duration: 6, words: said(s.narration) },
  shots: [{ asset: "clip", kind: "video", w: 1920, h: 1080, duration: 12 }],
}));

function longVideo() {
  const built = buildFootage(script, media, { voice: "preset:blend_documentary", style: nicheById("finance").style, openingTitle: false });
  const scene = addIntro(built.scene, "cinematic", { title: "Money" }).scene;
  scene.publish = { title: "Money", description: "", tags: ["money"], thumbnailText: "MONEY", checks: [], credits: [], niche: nicheById("finance").label };
  return scene;
}

describe("YouTube helpers", () => {
  it("writes chapters that start at 0:00 and follow the markers", () => {
    const text = chaptersText(longVideo());
    const lines = text.split("\n");
    expect(lines[0]).toBe("0:00 Part 1");
    expect(lines.slice(0).map((l) => l.split(" ").slice(1).join(" "))).toEqual(["Part 1", "Part 2", "Part 3"]);
    for (const l of lines) expect(l).toMatch(/^\d+:\d\d /);
  });

  it("returns no chapters for a short video", () => {
    const built = buildFootage({ ...script, scenes: scenes.slice(0, 2) }, media.slice(0, 2), { style: nicheById("finance").style });
    expect(chaptersText(built.scene)).toBe("");
  });

  it("exports subtitles in both formats", () => {
    const scene = longVideo();
    const srt = subtitles(scene, "srt");
    expect(srt.startsWith("1\n00:00:")).toBe(true);
    expect(srt).toMatch(/\d\d:\d\d:\d\d,\d{3} --> \d\d:\d\d:\d\d,\d{3}/);
    const vtt = subtitles(scene, "vtt");
    expect(vtt.startsWith("WEBVTT\n\n")).toBe(true);
    expect(vtt).toContain("scene number 1");
    // Cues never overlap.
    const times = [...srt.matchAll(/(\d\d):(\d\d):(\d\d),(\d{3}) --> (\d\d):(\d\d):(\d\d),(\d{3})/g)].map((m) => {
      const n = m.slice(1).map(Number);
      return [n[0] * 3600 + n[1] * 60 + n[2] + n[3] / 1000, n[4] * 3600 + n[5] * 60 + n[6] + n[7] / 1000];
    });
    for (let i = 1; i < times.length; i++) expect(times[i][0]).toBeGreaterThanOrEqual(times[i - 1][1] - 1e-6);
  });

  it("cuts a vertical Short from the opening scenes", () => {
    const res = makeShort(longVideo(), assets, 30)!;
    expect(res.problems).toEqual([]);
    expect(res.scene.width).toBeLessThan(res.scene.height);
    expect(res.scenes).toBe(4);
    expect(res.scene.duration).toBeLessThanOrEqual(31);
    const voice = res.scene.objects.find((o) => o.id === "sc1_voice") as AudioObj;
    expect(voice.asset).toBe("v0");
    expect(voice.words![0].start).toBeCloseTo(voice.start, 3);
    expect(res.scene.publish?.title).toContain("#shorts");
    expect(res.scene.slides!.some((s) => s.id === "intro")).toBe(false);
  });

  it("only cuts Shorts from AI videos", () => {
    expect(makeShort({ ...longVideo(), slides: [] }, assets)).toBeNull();
  });
});
