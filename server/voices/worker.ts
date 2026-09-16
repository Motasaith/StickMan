// The local voice engines run here, in their own Node process: the models need ~0.6 to 1.5 GB of
// memory, run for minutes, and load native ONNX code that doesn't belong in the web server.
// The server talks to this process with one JSON message per line on stdin and stdout.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import * as A from "./audio";
import * as kokoro from "./kokoro";
import * as clone from "./clone";
import { prepare } from "./chunker";
import { analyseReference, prepareReference } from "./reference";
import { MODELS_DIR } from "./paths";
import type { BlendComponent } from "./catalog";

// Libraries print to the console; only protocol messages may reach stdout.
const toStderr = (...args: unknown[]) => process.stderr.write(`${args.map(String).join(" ")}\n`);
console.log = toStderr;
console.info = toStderr;
console.warn = toStderr;

export type EngineVoice = { engine: "kokoro"; spec: string | BlendComponent[] } | { engine: "clone"; profile: string };

export type WorkerRequest =
  | { id: number; type: "speak"; text: string; voice: EngineVoice; speed?: number; lang?: string | null; out: string }
  | { id: number; type: "enrol"; wav: string; profile: string }
  | { id: number; type: "status" }
  | { id: number; type: "install"; what: "kokoro" | "clone" };

export type WorkerReply =
  | { id: number; kind: "progress"; progress: number; stage: string }
  | { id: number; kind: "done"; result: unknown }
  | { id: number; kind: "error"; error: string };

const send = (msg: WorkerReply) => process.stdout.write(`${JSON.stringify(msg)}\n`);

const kokoroFile = () => join(MODELS_DIR, "hf", "onnx-community", "Kokoro-82M-v1.0-ONNX", "onnx", "model_quantized.onnx");

async function speak(req: Extract<WorkerRequest, { type: "speak" }>) {
  const progress = (p: number, stage: string) => send({ id: req.id, kind: "progress", progress: p, stage });
  const script = prepare(req.text, { maxChars: 320, paragraphPause: 0.45 });
  if (!script.spoken.length) throw new Error("There is nothing to say.");
  const rate = req.voice.engine === "clone" ? clone.SAMPLE_RATE : kokoro.SAMPLE_RATE;
  // Only one engine is kept in memory at a time.
  if (req.voice.engine === "kokoro") clone.unload();
  else kokoro.unload();
  progress(0.02, req.voice.engine === "clone" ? "Loading the cloned voice" : "Loading the studio voices");
  const profile = req.voice.engine === "clone" ? await clone.loadProfile(req.voice.profile) : null;

  const segments: Float32Array[] = [];
  const cues: A.Cue[] = [];
  let cursor = 0;
  let done = 0;
  for (const chunk of script.chunks) {
    if (!chunk.text.trim()) {
      if (chunk.pauseAfter > 0) {
        segments.push(A.silence(chunk.pauseAfter, rate));
        cursor += chunk.pauseAfter;
      }
      continue;
    }
    progress(0.05 + (done / script.spoken.length) * 0.9, `Speaking part ${done + 1} of ${script.spoken.length}`);
    let piece =
      req.voice.engine === "kokoro"
        ? await kokoro.synthesize(chunk.text, req.voice.spec, { speed: req.speed ?? 1, lang: req.lang ?? null })
        : await clone.synthesize(chunk.text, profile!, {});
    done++;
    if (!piece.length) continue;
    piece = A.fade(A.trimSilence(piece, rate, -48, 25), rate, 6);
    const start = cursor;
    cursor += piece.length / rate;
    segments.push(piece);
    cues.push({ start, end: cursor, text: chunk.text });
    const gap = chunk.pauseAfter || 0.22;
    segments.push(A.silence(gap, rate));
    cursor += gap;
  }
  const master = A.normaliseLoudness(A.concat(segments), rate, -14);
  await mkdir(dirname(req.out), { recursive: true });
  await writeFile(req.out, A.encodeWav(master, rate));
  return { duration: master.length / rate, cues };
}

async function enrol(req: Extract<WorkerRequest, { type: "enrol" }>) {
  const decoded = A.decodeWav(await readFile(req.wav));
  const report = analyseReference(decoded.audio, decoded.rate);
  if (!report.ok) return { ok: false, report };
  kokoro.unload();
  send({ id: req.id, kind: "progress", progress: 0.3, stage: "Learning the voice" });
  const reference = prepareReference(decoded.audio, decoded.rate);
  const profile = await clone.enrol(reference, "q8");
  await clone.saveProfile(profile, req.profile);
  // A short sample of the reference, for previews in the voice list.
  const sample = req.profile.replace(/\.json$/, ".wav");
  await writeFile(sample, A.encodeWav(reference.slice(0, 24000 * 12), 24000));
  return { ok: true, report, sample };
}

async function install(req: Extract<WorkerRequest, { type: "install" }>) {
  if (req.what === "clone") {
    await clone.install("q8", (p) => send({ id: req.id, kind: "progress", progress: p.total ? p.received / p.total : 0, stage: `Downloading ${p.label}` }));
    return { installed: true };
  }
  send({ id: req.id, kind: "progress", progress: 0.1, stage: "Downloading the studio voices (about 90 MB)" });
  await kokoro.load("q8");
  await kokoro.resolveStyle("af_heart");
  return { installed: true };
}

async function status() {
  return {
    modelsDir: MODELS_DIR,
    kokoro: existsSync(kokoroFile()),
    clone: await clone.isInstalled("q8"),
    loaded: { kokoro: kokoro.isLoaded(), clone: clone.isLoaded() },
  };
}

// One request at a time: two generations on a few cores only slow each other down.
let queue: Promise<unknown> = Promise.resolve();

createInterface({ input: process.stdin }).on("line", (line) => {
  let req: WorkerRequest;
  try {
    req = JSON.parse(line) as WorkerRequest;
  } catch {
    return;
  }
  queue = queue.then(async () => {
    try {
      const result = req.type === "speak" ? await speak(req) : req.type === "enrol" ? await enrol(req) : req.type === "install" ? await install(req) : await status();
      send({ id: req.id, kind: "done", result });
    } catch (err) {
      send({ id: req.id, kind: "error", error: err instanceof Error ? err.message : String(err) });
    }
  });
});

// The server closing the pipe means it is done with us; finish what was asked first.
process.stdin.on("end", () => void queue.then(() => process.exit(0)));
