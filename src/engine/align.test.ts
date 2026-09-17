import { describe, expect, it } from "vitest";
import { alignScenes, groupSentences, sentencesOf } from "./align";
import { buildFootage, type VideoScript } from "./footage";
import { nicheById } from "./niches";
import type { AudioObj, VideoObj, Word } from "./scene";

/** Words as a recogniser would return them, one every 0.4s with a pause after sentences. */
function heard(text: string): Word[] {
  const out: Word[] = [];
  let t = 0.5;
  for (const w of text.split(/\s+/)) {
    out.push({ text: w, start: t, end: t + 0.35 });
    t += /[.!?]$/.test(w) ? 1.2 : 0.4;
  }
  return out;
}

describe("aligning scenes to a recording", () => {
  const scenes = ["Money never sleeps.", "Neither do the people who chase it, and they pay for it.", "This is their story."];

  it("finds each scene's stretch when the recording matches the script", () => {
    const spans = alignScenes(scenes, heard(scenes.join(" ")));
    expect(spans.map((s) => s.words.length)).toEqual([3, 12, 4]);
    expect(spans[0].start).toBeCloseTo(0.5, 3);
    // Scenes meet inside the pause between them.
    expect(spans[0].end).toBeGreaterThan(spans[0].words[2].end);
    expect(spans[1].start).toBeLessThanOrEqual(spans[1].words[0].start);
    expect(spans[0].end).toBeLessThanOrEqual(spans[1].start);
  });

  it("survives misheard, dropped and extra words", () => {
    const said = "Money never sleeps. Uh, neither do people who chase it and they pay for it big time. This is there story.";
    const spans = alignScenes(scenes, heard(said));
    expect(spans[0].words.map((w) => w.text).join(" ")).toBe("Money never sleeps.");
    expect(spans[1].words[0].text).toBe("Uh,");
    expect(spans[1].words.at(-1)!.text).toBe("time.");
    expect(spans[2].words.map((w) => w.text).join(" ")).toBe("This is there story.");
  });

  it("gives a skipped scene an empty stretch", () => {
    const spans = alignScenes(scenes, heard("Money never sleeps. This is their story."));
    expect(spans[1].words).toEqual([]);
    expect(spans[1].end - spans[1].start).toBe(0);
  });

  it("splits a script into sentences and groups them without changing a word", () => {
    const text = "One. Two is here! Three? " + "Word ".repeat(30).trim() + ".";
    const sentences = sentencesOf(text);
    expect(sentences.slice(0, 3)).toEqual(["One.", "Two is here!", "Three?"]);
    const groups = groupSentences(sentences, 10);
    expect(groups.join(" ")).toBe(sentences.join(" "));
  });
});

describe("building from the creator's own recording", () => {
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
      { id: "a", narration: "Money never sleeps.", visuals: ["city"], overlay: { kind: "title", text: "Money" } },
      { id: "b", narration: "Neither do the people who chase it.", visuals: ["office"] },
    ],
  };

  it("cuts one recording into the scenes, with no gaps added", () => {
    const { scene, problems } = buildFootage(
      script,
      [
        { narration: { asset: "aud_me", in: 0.4, duration: 1.6, words: [{ text: "Money", start: 0.1, end: 0.4 }] }, shots: [{ asset: "vid_1", kind: "video", w: 1280, h: 720, duration: 10 }] },
        { narration: { asset: "aud_me", in: 2.0, duration: 2.5, words: [{ text: "Neither", start: 0, end: 0.3 }] }, shots: [{ asset: "vid_2", kind: "video", w: 1280, h: 720, duration: 10 }] },
      ],
      { style: nicheById("finance").style, padding: { lead: 0, tail: 0 }, simple: true }
    );
    expect(problems).toEqual([]);
    const voices = scene.objects.filter((o): o is AudioObj => o.type === "audio");
    expect(voices.map((v) => [v.asset, v.in, v.start, v.duration])).toEqual([
      ["aud_me", 0.4, 0, 1.6],
      ["aud_me", 2, 1.6, 2.5],
    ]);
    expect(voices[0].voice).toBeUndefined();
    expect(voices[1].words![0].start).toBeCloseTo(1.6, 3);
    // Simple edit: straight cuts, no zoom, no titles.
    expect(scene.slides!.every((s) => s.transition.kind === "cut")).toBe(true);
    const shot = scene.objects.find((o): o is VideoObj => o.type === "video")!;
    expect(shot.tracks.scale![0].v).toBe(shot.tracks.scale![1].v);
    expect(scene.objects.some((o) => o.type === "text")).toBe(false);
    expect(scene.duration).toBeCloseTo(4.1, 3);
  });
});
