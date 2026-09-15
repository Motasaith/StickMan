// Voice clips: decoding, loudness envelopes for lip-sync, playback in step with the
// canvas, and an offline mix of the whole soundtrack for export.

import type { Asset, Scene, SoundKind } from "./engine/scene";
import { soundBuffer, soundLength } from "./sfx";

/** One piece of the soundtrack: a recorded voice asset or a generated sound effect. */
export interface Clip {
  key: string;
  asset?: string;
  sound?: { kind: SoundKind; duration: number; volume: number };
  at: number;
  duration: number;
}

let ctx: AudioContext | null = null;
export function audioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

async function bytesOf(src: string): Promise<ArrayBuffer> {
  const res = await fetch(src);
  return res.arrayBuffer();
}

const decoded = new Map<string, AudioBuffer>();
const decoding = new Map<string, Promise<AudioBuffer>>();

export function decodeAsset(asset: Pick<Asset, "id" | "src">): Promise<AudioBuffer> {
  const have = decoded.get(asset.id);
  if (have) return Promise.resolve(have);
  let job = decoding.get(asset.id);
  if (!job) {
    job = bytesOf(asset.src)
      .then((b) => audioContext().decodeAudioData(b))
      .then((buf) => {
        decoded.set(asset.id, buf);
        return buf;
      })
      .finally(() => decoding.delete(asset.id));
    decoding.set(asset.id, job);
  }
  return job;
}

/** Loudness per 1/rate seconds, 0..1, scaled so ordinary speech reaches about 1. */
export function envelopeOf(buf: AudioBuffer, rate = 30): number[] {
  const data = buf.getChannelData(0);
  const win = Math.max(1, Math.floor(buf.sampleRate / rate));
  const out: number[] = [];
  for (let i = 0; i < data.length; i += win) {
    let sum = 0;
    const end = Math.min(data.length, i + win);
    for (let j = i; j < end; j++) sum += data[j] * data[j];
    out.push(Math.sqrt(sum / (end - i)));
  }
  const sorted = [...out].sort((a, b) => a - b);
  const ref = sorted[Math.floor(sorted.length * 0.92)] || 1;
  return out.map((v) => {
    const n = v / ref;
    return n < 0.12 ? 0 : Math.round(Math.min(1, n) * 100) / 100;
  });
}

export function sceneClips(scene: Scene): Clip[] {
  const clips: Clip[] = [];
  for (const o of scene.objects) {
    if (o.type === "bubble" && o.audio) clips.push({ key: o.audio.asset, asset: o.audio.asset, at: o.audio.at, duration: o.audio.duration });
    if (o.type === "sound") {
      const duration = soundLength(o.kind, o.duration);
      clips.push({ key: `sfx:${o.kind}:${o.duration.toFixed(2)}`, sound: { kind: o.kind, duration: o.duration, volume: o.volume }, at: o.at, duration });
    }
  }
  return clips;
}

/** Start decoding or synthesizing a clip's audio if it isn't ready yet. */
function prepare(c: Clip, assets: Asset[]) {
  if (decoded.has(c.key) || decoding.has(c.key)) return;
  if (c.asset) {
    const a = assets.find((x) => x.id === c.asset);
    if (a) decodeAsset(a).catch(() => {});
  } else if (c.sound) {
    const job = soundBuffer(c.sound.kind, c.sound.duration).then((buf) => {
      decoded.set(c.key, buf);
      return buf;
    });
    decoding.set(c.key, job);
    job.finally(() => decoding.delete(c.key)).catch(() => {});
  }
}

// ── Live playback ────────────────────────────────────────────────────

let active: { sources: AudioBufferSourceNode[]; ctxStart: number; sceneStart: number; sig: string } | null = null;

function stopAll() {
  if (!active) return;
  for (const s of active.sources) {
    try {
      s.stop();
    } catch {
      /* already stopped */
    }
  }
  active = null;
}

/** Called every frame by the player: keeps voices playing in step with the timeline. */
export function syncAudio(playing: boolean, time: number, scene: Scene, assets: Asset[]) {
  if (!playing) {
    stopAll();
    return;
  }
  const clips = sceneClips(scene);
  if (!clips.length && !active) return;
  const ac = audioContext();
  const ready = clips.filter((c) => decoded.has(c.key));
  for (const c of clips) prepare(c, assets);
  const sig = ready.map((c) => `${c.key}@${c.at.toFixed(3)}`).join("|");
  const expected = active ? active.sceneStart + (ac.currentTime - active.ctxStart) : NaN;
  if (active && active.sig === sig && Math.abs(expected - time) < 0.25) return;

  stopAll();
  if (ac.state === "suspended") ac.resume().catch(() => {});
  const sources: AudioBufferSourceNode[] = [];
  for (const c of ready) {
    if (time >= c.at + c.duration) continue;
    const src = ac.createBufferSource();
    src.buffer = decoded.get(c.key)!;
    if (c.sound && c.sound.volume !== 1) {
      const g = ac.createGain();
      g.gain.value = c.sound.volume;
      src.connect(g).connect(ac.destination);
    } else src.connect(ac.destination);
    const delay = Math.max(0, c.at - time);
    const offset = Math.max(0, time - c.at);
    src.start(ac.currentTime + delay, offset);
    sources.push(src);
  }
  active = { sources, ctxStart: ac.currentTime, sceneStart: time, sig };
}

/** For diagnosing playback: what the audio engine is doing right now. */
export function audioDebug() {
  return { context: ctx?.state ?? "none", playing: active?.sources.length ?? 0, decoded: decoded.size };
}

export async function playClip(asset: Pick<Asset, "id" | "src">) {
  const buf = await decodeAsset(asset);
  const ac = audioContext();
  if (ac.state === "suspended") await ac.resume();
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.connect(ac.destination);
  src.start();
}

// ── Export ───────────────────────────────────────────────────────────

/** The whole soundtrack as one buffer, or null when the scene is silent. */
export async function mixSceneAudio(scene: Scene, assets: Asset[], sampleRate = 48000): Promise<AudioBuffer | null> {
  const clips = sceneClips(scene).filter((c) => c.at < scene.duration);
  if (!clips.length) return null;
  const length = Math.max(1, Math.ceil(scene.duration * sampleRate));
  const oac = new OfflineAudioContext(2, length, sampleRate);
  for (const c of clips) {
    let buf: AudioBuffer;
    if (c.asset) {
      const a = assets.find((x) => x.id === c.asset);
      if (!a) continue;
      buf = await oac.decodeAudioData(await bytesOf(a.src));
    } else if (c.sound) {
      buf = await soundBuffer(c.sound.kind, c.sound.duration);
    } else continue;
    const src = oac.createBufferSource();
    src.buffer = buf;
    const g = oac.createGain();
    g.gain.value = c.sound?.volume ?? 1;
    src.connect(g).connect(oac.destination);
    src.start(c.at);
  }
  return oac.startRendering();
}
