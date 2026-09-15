// Spoken lines through Microsoft Edge neural voices (free, no key), as in PromptCut.

import { EdgeTTS } from "node-edge-tts";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VOICES } from "../src/engine/voices";
import type { VoiceId } from "../src/engine/scene";

export function cleanForSpeech(text: string): string {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s*[\u2014\u2013]\s*/g, ", ")
    .replace(/[*_`#]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Returns MP3 bytes for the line, retrying a couple of times on network hiccups. */
export async function speak(text: string, voice: VoiceId): Promise<Buffer> {
  const v = VOICES[voice] ?? VOICES.man;
  const clean = cleanForSpeech(text);
  if (!clean) throw new Error("Nothing to say");
  const dir = await mkdtemp(join(tmpdir(), "stickman-tts-"));
  let lastError: unknown;
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const file = join(dir, `line-${attempt}.mp3`);
      try {
        // The last attempt drops pitch, which some voices reject.
        const tts = new EdgeTTS({ voice: v.edge, rate: v.rate, ...(attempt < 3 ? { pitch: v.pitch } : {}), timeout: 20_000 });
        await tts.ttsPromise(clean, file);
        const bytes = await readFile(file);
        if (bytes.length < 512) throw new Error("the voice service returned no audio");
        return bytes;
      } catch (err) {
        lastError = err;
        await new Promise((r) => setTimeout(r, attempt * 400));
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
  throw new Error(`Voice generation failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}
