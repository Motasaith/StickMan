import { expect, it } from "vitest";
import { sceneClips } from "./audio";
import { applyOps } from "./engine/ops";
import { emptyScene } from "./engine/scene";

it("excludes legacy music from playback and export while preserving narration and sound effects", () => {
  const scene = applyOps(emptyScene(), [
    { op: "audio", id: "old-music", asset: "song", role: "music", duration: 4 },
    { op: "audio", id: "voice", asset: "speech", role: "voiceover", duration: 4 },
    { op: "sound", kind: "whoosh", at: 1 },
  ], [{ id: "song", name: "song", kind: "audio", w: 0, h: 0, duration: 4 }, { id: "speech", name: "speech", kind: "audio", w: 0, h: 0, duration: 4 }]).scene;
  expect(scene.objects.some((o) => o.id === "old-music")).toBe(true);
  const clips = sceneClips(scene);
  expect(clips.some((c) => c.asset === "song")).toBe(false);
  expect(clips.some((c) => c.asset === "speech")).toBe(true);
  expect(clips.some((c) => c.sound?.kind === "whoosh")).toBe(true);
});
