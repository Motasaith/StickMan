// The soundtrack: voices, narration, recordings, uploads, video sound and sound effects.
// Decoding, loudness envelopes, playback in step with the canvas, and the offline mix for export.

import type { Asset, Scene, SoundKind } from "./engine/scene";
import { soundBuffer, soundLength } from "./sfx";

/** One piece of the soundtrack. `in` is where in the source it starts; `rate` its speed. */
export interface Clip {
  key: string;
  asset?: string;
  sound?: { kind: SoundKind; duration: number; volume: number };
  at: number;
  duration: number;
  in: number;
  rate: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  /** Video sound: played by the video element live, mixed from the file for export. */
  fromVideo?: boolean;
}

let ctx: AudioContext | null = null;
export function audioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

async function bytesOf(src: string): Promise<ArrayBuffer> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`couldn't load sound (${res.status})`);
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
  const base = { in: 0, rate: 1, volume: 1, fadeIn: 0, fadeOut: 0 };
  for (const o of scene.objects) {
    if (o.hidden) continue;
    if (o.type === "bubble" && o.audio) clips.push({ ...base, key: o.audio.asset, asset: o.audio.asset, at: o.audio.at, duration: o.audio.duration });
    if (o.type === "sound") {
      const duration = soundLength(o.kind, o.duration);
      clips.push({ ...base, key: `sfx:${o.kind}:${o.duration.toFixed(2)}`, sound: { kind: o.kind, duration: o.duration, volume: o.volume }, at: o.at, duration, volume: o.volume });
    }
    if (o.type === "audio" && o.role !== "music" && o.asset && o.volume > 0) {
      clips.push({ key: o.asset, asset: o.asset, at: o.start, duration: o.duration, in: o.in, rate: o.speed, volume: o.volume, fadeIn: o.fadeIn, fadeOut: o.fadeOut });
    }
    if (o.type === "video" && o.volume > 0 && !o.reverse) {
      clips.push({ key: o.asset, asset: o.asset, at: o.start, duration: o.duration, in: o.in, rate: o.speed, volume: o.volume, fadeIn: o.fadeIn, fadeOut: o.fadeOut, fromVideo: true });
    }
  }
  return clips;
}

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

/** A gain node that fades the clip in and out, placed on `ac`'s clock where the clip starts. */
function gainFor(ac: BaseAudioContext, c: Clip, startAt: number, offsetInClip: number): GainNode {
  const g = ac.createGain();
  const g0 = startAt;
  const clipStart = g0 - offsetInClip;
  const fadeInEnd = clipStart + c.fadeIn;
  const fadeOutStart = clipStart + c.duration - c.fadeOut;
  const valueAt = (t: number) => {
    let v = c.volume;
    if (c.fadeIn > 0 && t < fadeInEnd) v *= Math.max(0, (t - clipStart) / c.fadeIn);
    if (c.fadeOut > 0 && t > fadeOutStart) v *= Math.max(0, (clipStart + c.duration - t) / c.fadeOut);
    return v;
  };
  g.gain.setValueAtTime(valueAt(g0), g0);
  if (c.fadeIn > 0 && fadeInEnd > g0) g.gain.linearRampToValueAtTime(c.volume, fadeInEnd);
  if (c.fadeOut > 0) {
    g.gain.setValueAtTime(valueAt(Math.max(g0, fadeOutStart)), Math.max(g0, fadeOutStart));
    g.gain.linearRampToValueAtTime(0, clipStart + c.duration);
  }
  return g;
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

/** Called every frame by the player: keeps sound playing in step with the timeline. */
export function syncAudio(playing: boolean, time: number, scene: Scene, assets: Asset[]) {
  if (!playing) {
    stopAll();
    return;
  }
  const clips = sceneClips(scene).filter((c) => !c.fromVideo);
  if (!clips.length && !active) return;
  const ac = audioContext();
  const ready = clips.filter((c) => decoded.has(c.key));
  for (const c of clips) prepare(c, assets);
  const sig = ready.map((c) => `${c.key}@${c.at.toFixed(3)}:${c.in.toFixed(3)}:${c.duration.toFixed(3)}:${c.rate}:${c.volume}`).join("|");
  const expected = active ? active.sceneStart + (ac.currentTime - active.ctxStart) : NaN;
  if (active && active.sig === sig && Math.abs(expected - time) < 0.25) return;

  stopAll();
  if (ac.state === "suspended") ac.resume().catch(() => {});
  const sources: AudioBufferSourceNode[] = [];
  for (const c of ready) {
    if (time >= c.at + c.duration) continue;
    const src = ac.createBufferSource();
    src.buffer = decoded.get(c.key)!;
    src.playbackRate.value = c.rate;
    const delay = Math.max(0, c.at - time);
    const into = Math.max(0, time - c.at);
    const when = ac.currentTime + delay;
    src.connect(gainFor(ac, c, when, into)).connect(ac.destination);
    src.start(when, c.in + into * c.rate, Math.max(0.01, (c.duration - into) * c.rate));
    sources.push(src);
  }
  active = { sources, ctxStart: ac.currentTime, sceneStart: time, sig };
}

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
  const buffers = new Map<string, AudioBuffer | null>();
  let any = false;
  for (const c of clips) {
    let buf: AudioBuffer | null | undefined = buffers.get(c.key);
    if (buf === undefined) {
      try {
        if (c.asset) {
          const a = assets.find((x) => x.id === c.asset);
          buf = a ? await oac.decodeAudioData(await bytesOf(a.src)) : null;
        } else if (c.sound) buf = await soundBuffer(c.sound.kind, c.sound.duration);
        else buf = null;
      } catch {
        // A video without a sound track can't be decoded: it is simply silent.
        buf = null;
      }
      buffers.set(c.key, buf);
    }
    if (!buf) continue;
    any = true;
    const src = oac.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = c.rate;
    src.connect(gainFor(oac, c, c.at, 0)).connect(oac.destination);
    src.start(c.at, c.in, Math.max(0.01, c.duration * c.rate));
  }
  return any ? oac.startRendering() : null;
}
