// Real voices for speech bubbles and narration: text-to-speech on the server (with the time
// each word is spoken), then bubbles and narration are timed to the audio, captions follow the
// words, slides grow to fit, and speakers' mouths follow the loudness.

import { cloneScene, findObj, type AudioObj, type BubbleObj, type Scene, type VoiceId } from "./engine/scene";
import { decodeAsset, envelopeOf } from "./audio";
import { useStore } from "./store";
import { directScene } from "./engine/director";
import { fitSlidesToNarration, syncCaptions } from "./engine/slides";
import { api } from "./lib/api";

export function voiceFor(scene: Scene, bubble: BubbleObj): VoiceId | null {
  if (bubble.thought || bubble.voice === "none") return null;
  if (bubble.voice) return bubble.voice;
  const who = bubble.target ? findObj(scene, bubble.target) : undefined;
  if (who?.type === "stickman") return who.voice ?? (who.look?.style === "robot" ? "robot" : "man");
  if (who?.type === "creature") return who.voice ?? (who.species === "custom" ? "boy" : who.species === "fish" ? "boy" : who.species);
  return "narrator";
}

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

export function narrationNeedsVoice(o: AudioObj): boolean {
  return o.role === "narration" && !o.asset && !!o.text?.trim();
}

export interface VoiceReport {
  made: number;
  failed: string[];
  overlaps: string[];
}

/** Voice every line and narration that has no (up-to-date) recording yet. */
export async function generateVoices(onlyId?: string, onProgress?: (done: number, total: number) => void): Promise<VoiceReport> {
  const start = useStore.getState().scene;
  const bubbles = start.objects.filter((o): o is BubbleObj => o.type === "bubble" && (!onlyId || o.id === onlyId) && needsVoice(start, o));
  const narrations = start.objects.filter((o): o is AudioObj => o.type === "audio" && (!onlyId || o.id === onlyId) && narrationNeedsVoice(o));
  const total = bubbles.length + narrations.length;
  const report: VoiceReport = { made: 0, failed: [], overlaps: [] };
  let done = 0;
  const jobs: Array<() => Promise<void>> = [
    ...bubbles.map((b) => async () => {
      const voice = voiceFor(start, b)!;
      const rec = await api.voice(b.text, voice);
      const asset = { id: rec.id, name: `voice: ${b.text.slice(0, 24)}`, src: rec.src, w: 0, h: 0, kind: "audio" as const, duration: rec.duration, origin: "tts", waveform: rec.waveform };
      useStore.getState().addAsset(asset);
      const buf = await decodeAsset(asset);
      const envelope = envelopeOf(buf);
      useStore.getState().amend((scene) => {
        const next = cloneScene(scene);
        const bubble = findObj(next, b.id);
        if (!bubble || bubble.type !== "bubble") return scene;
        const at = bubbleStart(bubble);
        const duration = buf.duration;
        bubble.audio = { asset: asset.id, at, duration, envelope, rate: 30, text: bubble.text, voice };
        const hide = at + duration + 0.35;
        bubble.tracks.opacity = at > 0 ? [{ t: 0, v: 0 }, { t: at, v: 1, e: "step" }, { t: hide, v: 0, e: "step" }] : [{ t: 0, v: 1 }, { t: hide, v: 0, e: "step" }];
        bubble.tracks.reveal = [
          { t: at, v: 0 },
          { t: at + Math.min(duration * 0.8, Math.max(0.3, bubble.text.length * 0.05)), v: 1 },
        ];
        if (hide + 0.3 > next.duration) next.duration = Math.ceil((hide + 0.3) * 10) / 10;
        return next;
      });
    }),
    ...narrations.map((n) => async () => {
      const voice = n.voice ?? "narrator";
      const rec = await api.voice(n.text!, voice);
      const asset = { id: rec.id, name: `narration: ${n.text!.slice(0, 24)}`, src: rec.src, w: 0, h: 0, kind: "audio" as const, duration: rec.duration, origin: "tts", waveform: rec.waveform };
      useStore.getState().addAsset(asset);
      let envelope: number[] | undefined;
      if (n.speaker) envelope = envelopeOf(await decodeAsset(asset));
      useStore.getState().amend((scene) => {
        const next = cloneScene(scene);
        const o = findObj(next, n.id);
        if (!o || o.type !== "audio" || o.text !== n.text) return scene;
        o.asset = asset.id;
        o.duration = Math.round(rec.duration * 1000) / 1000;
        o.in = 0;
        o.voice = voice;
        o.words = rec.words.length ? rec.words.map((w) => ({ text: w.text, start: o.start + w.start, end: o.start + w.end })) : o.words;
        if (envelope) {
          o.envelope = envelope;
          o.rate = 30;
        }
        return next;
      });
    }),
  ];
  const queue = [...jobs];
  const worker = async () => {
    while (queue.length) {
      const job = queue.shift()!;
      try {
        await job();
        report.made++;
      } catch (err) {
        report.failed.push((err as Error).message);
      }
      onProgress?.(++done, total);
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  // Slides grow to fit their narration; captions follow the recorded words.
  if (narrations.length) {
    useStore.getState().amend((scene) => {
      const next = cloneScene(scene);
      fitSlidesToNarration(next);
      syncCaptions(next);
      return next;
    });
  }

  // Voices can make a 3D film longer than its camera plan: the director covers the new ending.
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

/** How many lines and narrations still need a voice. */
export function pendingVoices(scene: Scene): number {
  return scene.objects.filter((o) => (o.type === "bubble" && needsVoice(scene, o)) || (o.type === "audio" && narrationNeedsVoice(o))).length;
}
