// What people say in a video or recording, word by word, for captions. Runs OpenAI's Whisper
// locally with Hugging Face's JavaScript runtime (as PromptCut does): no key and no bill.
// The model downloads once on first use (about 150 MB) and is cached.
// STT_MODEL picks another model (default onnx-community/whisper-base_timestamped).

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { join } from "node:path";
import { DATA_DIR } from "./media";

/** A real Node import, so the dev server doesn't transform the package (it breaks its model loading). */
const nativeImport = new Function("m", "return import(m)") as (m: string) => Promise<typeof import("@huggingface/transformers")>;

const execFileAsync = promisify(execFile);
const MODEL = process.env.STT_MODEL?.trim() || "onnx-community/whisper-base_timestamped";
const RATE = 16_000;
export const MAX_TRANSCRIBE_SEC = 15 * 60;

export const SPEECH_LANGUAGES = [
  "english", "urdu", "hindi", "arabic", "punjabi", "bengali", "persian", "turkish", "indonesian", "malay",
  "spanish", "french", "german", "portuguese", "italian", "russian", "chinese", "japanese", "korean",
] as const;
export type SpeechLanguage = (typeof SPEECH_LANGUAGES)[number];

type Recognizer = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string; chunks?: Array<{ text: string; timestamp: [number, number | null] }> }>;
let recognizer: Promise<Recognizer> | null = null;

function getRecognizer(): Promise<Recognizer> {
  if (!recognizer) {
    recognizer = (async () => {
      const { pipeline, env } = await nativeImport("@huggingface/transformers");
      env.cacheDir = join(DATA_DIR, "models");
      try {
        return (await pipeline("automatic-speech-recognition", MODEL, { dtype: "q8" })) as unknown as Recognizer;
      } catch (err) {
        // Downloading from inside the dev server fails; fetch the model in a plain Node process, then load it.
        if (!/model file|fetch/i.test((err as Error).message)) throw err;
        await downloadModel();
        return (await pipeline("automatic-speech-recognition", MODEL, { dtype: "q8" })) as unknown as Recognizer;
      }
    })().catch((err) => {
      recognizer = null;
      throw err;
    });
  }
  return recognizer;
}

function downloadModel(): Promise<void> {
  const code = `import { pipeline, env } from "@huggingface/transformers"; env.cacheDir = ${JSON.stringify(join(DATA_DIR, "models"))}; await pipeline("automatic-speech-recognition", ${JSON.stringify(MODEL)}, { dtype: "q8" });`;
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ["--input-type=module", "-e", code], { cwd: process.cwd(), windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => (err = (err + d.toString()).slice(-1000)));
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`The speech model couldn't be downloaded: ${err.trim().slice(-300)}`))));
  });
}

let queue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => {});
  return next;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Words of a media file between `from` and `to` seconds, timed in seconds of the source. */
export function transcribe(file: string, language: SpeechLanguage, from = 0, to: number | null = null): Promise<Array<{ start: number; end: number; text: string }>> {
  return oneAtATime(async () => {
    if (!ffmpegPath) throw new Error("ffmpeg is unavailable");
    const start = Math.max(0, from);
    const length = Math.min(MAX_TRANSCRIBE_SEC, to !== null ? Math.max(0.1, to - start) : MAX_TRANSCRIBE_SEC);
    const { stdout } = await execFileAsync(
      ffmpegPath as unknown as string,
      ["-v", "error", "-ss", start.toFixed(3), "-t", length.toFixed(3), "-i", file, "-vn", "-ac", "1", "-ar", String(RATE), "-f", "f32le", "pipe:1"],
      { encoding: "buffer", maxBuffer: Math.ceil(length * RATE * 4) + 1024 * 1024, timeout: 180_000, windowsHide: true }
    );
    const pcm = stdout as Buffer;
    if (pcm.byteLength < RATE * 4 * 0.2) return [];
    const audio = new Float32Array(pcm.byteLength / 4);
    new Uint8Array(audio.buffer).set(pcm.subarray(0, audio.byteLength));
    const asr = await getRecognizer();
    const out = await asr(audio, { return_timestamps: "word", chunk_length_s: 30, stride_length_s: 5, language, task: "transcribe" });
    const words: Array<{ start: number; end: number; text: string }> = [];
    for (const c of out.chunks ?? []) {
      const text = c.text.trim();
      const [s, e] = c.timestamp;
      if (!text || /^\[.*\]$/.test(text) || s == null) continue;
      const end = start + (e ?? s + 0.3);
      // Whisper folds the silence before a word into it; no word takes that long.
      const plausible = 0.25 + 0.09 * text.length;
      const ws = Math.max(start + s, end - Math.max(plausible, 0.4));
      words.push({ text: text.slice(0, 80), start: round(ws), end: round(Math.max(end, ws + 0.05)) });
    }
    return words;
  });
}
