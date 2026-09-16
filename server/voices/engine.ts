// The server's side of the voice worker: starts it on first use, sends one request at a time,
// reports progress, and stops it after a few idle minutes so its memory goes back to the system.

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import type { EngineVoice, WorkerReply } from "./worker";

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; onProgress?: (p: number, stage: string) => void };

interface WorkerState {
  proc: ChildProcessWithoutNullStreams | null;
  next: number;
  pending: Map<number, Pending>;
  idle: NodeJS.Timeout | null;
  stderr: string;
}

const IDLE_MS = 5 * 60_000;

// The dev server reloads this module often; the worker must survive that.
const g = globalThis as unknown as { __stickmanVoiceWorker?: WorkerState };
const state: WorkerState = (g.__stickmanVoiceWorker ??= { proc: null, next: 1, pending: new Map(), idle: null, stderr: "" });

function start(): ChildProcessWithoutNullStreams {
  if (state.proc && state.proc.exitCode === null) return state.proc;
  const proc = spawn(process.execPath, ["--import", "tsx", resolve(process.cwd(), "server/voices/worker.ts")], { cwd: process.cwd(), windowsHide: true });
  state.proc = proc;
  state.stderr = "";
  createInterface({ input: proc.stdout }).on("line", (line) => {
    let msg: WorkerReply;
    try {
      msg = JSON.parse(line) as WorkerReply;
    } catch {
      return;
    }
    const p = state.pending.get(msg.id);
    if (!p) return;
    if (msg.kind === "progress") p.onProgress?.(msg.progress, msg.stage);
    else {
      state.pending.delete(msg.id);
      if (msg.kind === "done") p.resolve(msg.result);
      else p.reject(new Error(msg.error));
      armIdle();
    }
  });
  proc.stderr.on("data", (d) => (state.stderr = (state.stderr + d.toString()).slice(-4000)));
  proc.on("exit", (code) => {
    if (state.proc === proc) state.proc = null;
    const why = new Error(`The voice engine stopped (code ${code}). ${state.stderr.trim().split("\n").slice(-3).join(" ")}`.trim());
    for (const [id, p] of state.pending) {
      state.pending.delete(id);
      p.reject(why);
    }
  });
  return proc;
}

function armIdle() {
  if (state.idle) clearTimeout(state.idle);
  if (state.pending.size) return;
  state.idle = setTimeout(() => {
    if (!state.pending.size && state.proc) state.proc.stdin.end();
  }, IDLE_MS);
  state.idle.unref?.();
}

function call<T>(msg: Record<string, unknown>, onProgress?: (p: number, stage: string) => void): Promise<T> {
  const proc = start();
  if (state.idle) clearTimeout(state.idle);
  const id = state.next++;
  return new Promise<T>((res, rej) => {
    state.pending.set(id, { resolve: res as (v: unknown) => void, reject: rej, onProgress });
    proc.stdin.write(`${JSON.stringify({ ...msg, id })}\n`);
  });
}

export interface EngineStatus {
  modelsDir: string;
  kokoro: boolean;
  clone: boolean;
  loaded: { kokoro: boolean; clone: boolean };
}

export const engineStatus = () => call<EngineStatus>({ type: "status" });

export const synthesizeToWav = (text: string, voice: EngineVoice, out: string, opts: { speed?: number; lang?: string | null } = {}, onProgress?: (p: number, stage: string) => void) =>
  call<{ duration: number; cues: Array<{ start: number; end: number; text: string }> }>({ type: "speak", text, voice, out, ...opts }, onProgress);

export interface ReferenceReport {
  ok: boolean;
  duration: number;
  score: number;
  issues: string[];
  tips: string[];
}

export const enrolVoice = (wav: string, profile: string, onProgress?: (p: number, stage: string) => void) =>
  call<{ ok: boolean; report: ReferenceReport; sample?: string }>({ type: "enrol", wav, profile }, onProgress);

export const installModels = (what: "kokoro" | "clone", onProgress?: (p: number, stage: string) => void) => call<{ installed: boolean }>({ type: "install", what }, onProgress);
