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

export interface SpokenWord {
  start: number;
  end: number;
  text: string;
}

/** Returns MP3 bytes for the line, retrying a couple of times on network hiccups. */
export async function speak(text: string, voice: VoiceId): Promise<Buffer> {
  return (await speakWithWords(text, voice)).mp3;
}

/** MP3 bytes plus when each word is spoken (seconds from the start of the audio). */
export async function speakWithWords(text: string, voice: VoiceId): Promise<{ mp3: Buffer; words: SpokenWord[] }> {
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
        const tts = new EdgeTTS({ voice: v.edge, rate: v.rate, ...(attempt < 3 ? { pitch: v.pitch } : {}), timeout: 30_000, saveSubtitles: true });
        await tts.ttsPromise(clean, file);
        const bytes = await readFile(file);
        if (bytes.length < 512) throw new Error("the voice service returned no audio");
        let words: SpokenWord[] = [];
        try {
          const cues = JSON.parse(await readFile(`${file}.json`, "utf8")) as Array<{ part: string; start: number; end: number }>;
          words = cues
            .filter((c) => c.part && c.part.trim() && !/^[.,!?;:"'()]+$/.test(c.part.trim()))
            .map((c) => ({ text: c.part.trim(), start: c.start / 1000, end: Math.max(c.end, c.start + 60) / 1000 }));
        } catch {
          words = [];
        }
        return { mp3: bytes, words };
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
