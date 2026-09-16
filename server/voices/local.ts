// Speech from the studio voices on this computer, in the same shape as the Edge voices:
// audio plus the time each word is spoken.

import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { CATALOG, PRESET_BLENDS } from "./catalog";
import { getSavedVoice } from "./library";
import { synthesizeToWav } from "./engine";
import { DATA_DIR } from "./paths";
import type { EngineVoice } from "./worker";
import type { SpokenWord } from "../tts";

/** Turn "kokoro:..", "preset:.." or "custom:.." into what the engine needs. */
export async function engineVoiceFor(ref: string): Promise<{ voice: EngineVoice; label: string }> {
  const [kind, id] = ref.split(":", 2) as [string, string];
  if (kind === "kokoro") {
    const meta = CATALOG.find((v) => v.id === id);
    if (!meta) throw new Error(`There is no studio voice called "${id}".`);
    return { voice: { engine: "kokoro", spec: id }, label: meta.name };
  }
  if (kind === "preset") {
    const preset = PRESET_BLENDS.find((p) => p.id === id);
    if (!preset) throw new Error(`There is no blend called "${id}".`);
    return { voice: { engine: "kokoro", spec: preset.components }, label: preset.name };
  }
  if (kind === "custom") {
    const saved = await getSavedVoice(id);
    if (!saved) throw new Error("That saved voice no longer exists.");
    if (saved.kind === "clone") return { voice: { engine: "clone", profile: saved.profile! }, label: saved.name };
    return { voice: { engine: "kokoro", spec: saved.blend! }, label: saved.name };
  }
  throw new Error(`Unknown voice "${ref}".`);
}

/**
 * Local engines report when each sentence starts and ends; words inside a sentence are spread
 * by their length, which keeps captions within a word or two of the voice.
 */
export function wordsFromCues(cues: Array<{ start: number; end: number; text: string }>): SpokenWord[] {
  const words: SpokenWord[] = [];
  for (const cue of cues) {
    const parts = cue.text.split(/\s+/).filter((w) => w && !/^[.,!?;:"'()\-]+$/.test(w));
    if (!parts.length) continue;
    const weights = parts.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length + 2);
    const total = weights.reduce((a, b) => a + b, 0);
    let t = cue.start;
    parts.forEach((text, i) => {
      const len = ((cue.end - cue.start) * weights[i]) / total;
      words.push({ text, start: Math.round(t * 1000) / 1000, end: Math.round((t + len) * 1000) / 1000 });
      t += len;
    });
  }
  return words;
}

/** Speak with a local voice; returns WAV bytes and word timings. */
export async function speakLocal(text: string, ref: string, onProgress?: (p: number, stage: string) => void): Promise<{ audio: Buffer; ext: ".wav"; words: SpokenWord[]; duration: number }> {
  const { voice } = await engineVoiceFor(ref);
  const dir = join(DATA_DIR, "tmp");
  await mkdir(dir, { recursive: true });
  const out = join(dir, `voice-${randomBytes(5).toString("hex")}.wav`);
  try {
    const { duration, cues } = await synthesizeToWav(text, voice, out, {}, onProgress);
    return { audio: await readFile(out), ext: ".wav", words: wordsFromCues(cues), duration };
  } finally {
    await rm(out, { force: true }).catch(() => {});
  }
}

/**
 * Rough seconds of computer time per second of speech on this machine, for time estimates.
 * Measured on a 2015 laptop CPU; newer ones are several times faster.
 */
export const REALTIME_FACTOR = { edge: 0.05, kokoro: 3, clone: 63 } as const;
