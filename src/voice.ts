// Gives speech bubbles a real voice: text-to-speech on the server, then the bubble is
// timed to the audio and the speaker's mouth follows its loudness.

import { cloneScene, findObj, type BubbleObj, type Scene, type VoiceId } from "./engine/scene";
import { decodeAsset, envelopeOf } from "./audio";
import { useStore } from "./store";
import { directScene } from "./engine/director";

export function voiceFor(scene: Scene, bubble: BubbleObj): VoiceId | null {
  if (bubble.thought || bubble.voice === "none") return null;
  if (bubble.voice) return bubble.voice;
  const who = bubble.target ? findObj(scene, bubble.target) : undefined;
  if (who?.type === "stickman") return who.voice ?? (who.look?.style === "robot" ? "robot" : "man");
  if (who?.type === "creature") return who.voice ?? (who.species === "custom" ? "boy" : who.species === "fish" ? "boy" : who.species);
  return "narrator";
}

/** When the bubble first shows. */
function bubbleStart(b: BubbleObj): number {
  const keys = b.tracks.opacity;
  if (!keys?.length) return 0;
  return keys.find((k) => k.v > 0.5)?.t ?? 0;
}

export function needsVoice(scene: Scene, b: BubbleObj): boolean {
  const voice = voiceFor(scene, b);
  if (!voice) return false;
  return !b.audio || b.audio.text !== b.text || b.audio.voice !== voice;
}

export interface VoiceReport {
  made: number;
  failed: string[];
  overlaps: string[];
}

/** Record every line that has no (up-to-date) voice yet. Only these bubbles are changed. */
export async function generateVoices(onlyId?: string, onProgress?: (done: number, total: number) => void): Promise<VoiceReport> {
  const start = useStore.getState().scene;
  const todo = start.objects.filter((o): o is BubbleObj => o.type === "bubble" && (!onlyId || o.id === onlyId) && needsVoice(start, o));
  const report: VoiceReport = { made: 0, failed: [], overlaps: [] };
  let done = 0;
  const queue = [...todo];
  const worker = async () => {
    while (queue.length) {
      const b = queue.shift()!;
      const voice = voiceFor(start, b)!;
      try {
        const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: b.text, voice }) });
        const data = (await res.json()) as { audio?: string; error?: string };
        if (!res.ok || !data.audio) throw new Error(data.error ?? `error ${res.status}`);
        const assetId = `voice_${Math.random().toString(36).slice(2, 10)}`;
        const buf = await decodeAsset({ id: assetId, src: data.audio });
        useStore.getState().addAsset({ id: assetId, name: `voice: ${b.text.slice(0, 24)}`, src: data.audio, w: 0, h: 0, kind: "audio", duration: buf.duration });
        const envelope = envelopeOf(buf);
        useStore.getState().amend((scene) => {
          const next = cloneScene(scene);
          const bubble = findObj(next, b.id);
          if (!bubble || bubble.type !== "bubble") return scene;
          const at = bubbleStart(bubble);
          const duration = buf.duration;
          bubble.audio = { asset: assetId, at, duration, envelope, rate: 30, text: bubble.text, voice };
          const hide = at + duration + 0.35;
          bubble.tracks.opacity = at > 0 ? [{ t: 0, v: 0 }, { t: at, v: 1, e: "step" }, { t: hide, v: 0, e: "step" }] : [{ t: 0, v: 1 }, { t: hide, v: 0, e: "step" }];
          bubble.tracks.reveal = [
            { t: at, v: 0 },
            { t: at + Math.min(duration * 0.8, Math.max(0.3, bubble.text.length * 0.05)), v: 1 },
          ];
          if (hide + 0.3 > next.duration) next.duration = Math.ceil((hide + 0.3) * 10) / 10;
          return next;
        });
        report.made++;
      } catch (err) {
        report.failed.push(`"${b.text.slice(0, 30)}": ${(err as Error).message}`);
      }
      onProgress?.(++done, todo.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  // Voices can make the film longer than the 3D camera plan: let the director cover the new ending.
  const after = useStore.getState().scene;
  const camKeys = Object.values(after.camera3d?.tracks ?? {}).flatMap((k) => k ?? []);
  if (after.mode === "3d" && after.duration > start.duration + 0.5 && camKeys.length) {
    const lastKey = Math.max(...camKeys.map((k) => k.t));
    if (lastKey < after.duration - 1.5 && lastKey >= start.duration - 2) {
      useStore.getState().amend((scene) => {
        const next = cloneScene(scene);
        directScene(next, lastKey);
        return next;
      });
    }
  }

  // Lines of the same speaker that now run into each other.
  const scene = useStore.getState().scene;
  const bySpeaker = new Map<string, BubbleObj[]>();
  for (const o of scene.objects) if (o.type === "bubble" && o.audio) bySpeaker.set(o.target ?? "narrator", [...(bySpeaker.get(o.target ?? "narrator") ?? []), o]);
  for (const [speaker, lines] of bySpeaker) {
    lines.sort((a, b) => a.audio!.at - b.audio!.at);
    for (let i = 1; i < lines.length; i++) {
      const prev = lines[i - 1].audio!;
      const cur = lines[i].audio!;
      if (prev.at + prev.duration > cur.at + 0.05) report.overlaps.push(`${speaker}'s "${lines[i - 1].text.slice(0, 20)}" runs ${(prev.at + prev.duration - cur.at).toFixed(1)}s into the next line`);
    }
  }
  return report;
}
