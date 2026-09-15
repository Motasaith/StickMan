// Sound effects made from scratch with Web Audio, so there are no files to download
// and the same effect always sounds the same (noise uses a fixed seed).

import type { SoundKind } from "./engine/scene";

const SR = 48000;

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

type Build = (ctx: OfflineAudioContext, out: AudioNode, len: number) => void;

function noiseBuffer(ctx: BaseAudioContext, seconds: number, seed: number, brown = false): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.max(1, Math.ceil(seconds * SR)), SR);
  const d = buf.getChannelData(0);
  const r = rng(seed);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = r();
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return buf;
}

function env(g: GainNode, t0: number, attack: number, peak: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}

function tone(ctx: BaseAudioContext, out: AudioNode, type: OscillatorType, t0: number, dur: number, f0: number, f1: number, peak = 0.5, attack = 0.005) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  const g = ctx.createGain();
  env(g, t0, attack, peak, dur);
  o.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + attack + dur + 0.05);
}

function noise(ctx: BaseAudioContext, out: AudioNode, t0: number, dur: number, seed: number, filter: BiquadFilterType, f0: number, f1: number, peak = 0.5, attack = 0.01, q = 1, brown = false) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, dur + attack + 0.1, seed, brown);
  const bq = ctx.createBiquadFilter();
  bq.type = filter;
  bq.Q.value = q;
  bq.frequency.setValueAtTime(f0, t0);
  bq.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  const g = ctx.createGain();
  env(g, t0, attack, peak, dur);
  src.connect(bq).connect(g).connect(out);
  src.start(t0);
}

const RECIPES: Record<SoundKind, { length: number; build: Build }> = {
  pop: { length: 0.2, build: (c, o) => tone(c, o, "sine", 0, 0.12, 900, 180, 0.7) },
  boing: {
    length: 0.9,
    build: (c, o) => {
      const osc = c.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(140, 0);
      osc.frequency.linearRampToValueAtTime(420, 0.08);
      osc.frequency.exponentialRampToValueAtTime(160, 0.8);
      const lfo = c.createOscillator();
      lfo.frequency.value = 18;
      const depth = c.createGain();
      depth.gain.value = 40;
      lfo.connect(depth).connect(osc.frequency);
      const g = c.createGain();
      env(g, 0, 0.01, 0.6, 0.8);
      osc.connect(g).connect(o);
      osc.start(0);
      lfo.start(0);
    },
  },
  whoosh: { length: 0.7, build: (c, o) => noise(c, o, 0, 0.55, 3, "bandpass", 300, 2400, 0.9, 0.2, 1.5) },
  thud: {
    length: 0.4,
    build: (c, o) => {
      tone(c, o, "sine", 0, 0.3, 110, 40, 0.9);
      noise(c, o, 0, 0.08, 7, "lowpass", 900, 200, 0.5);
    },
  },
  ding: {
    length: 1.6,
    build: (c, o) => {
      tone(c, o, "sine", 0, 1.4, 1318, 1318, 0.45);
      tone(c, o, "sine", 0, 0.9, 2636, 2636, 0.15);
    },
  },
  click: { length: 0.08, build: (c, o) => noise(c, o, 0, 0.03, 11, "highpass", 2000, 2000, 0.6, 0.001) },
  splash: {
    length: 1.0,
    build: (c, o) => {
      noise(c, o, 0, 0.8, 13, "lowpass", 3500, 500, 0.8, 0.01);
      const r = rng(5);
      for (let i = 0; i < 7; i++) tone(c, o, "sine", 0.05 + Math.abs(r()) * 0.5, 0.06, 600 + Math.abs(r()) * 900, 1400 + Math.abs(r()) * 900, 0.12);
    },
  },
  applause: {
    length: 3.0,
    build: (c, o) => {
      const r = rng(17);
      for (let i = 0; i < 140; i++) noise(c, o, Math.abs(r()) * 2.6, 0.04, 100 + i, "bandpass", 1500 + Math.abs(r()) * 2000, 1500, 0.25, 0.002, 0.8);
    },
  },
  thunder: {
    length: 3.5,
    build: (c, o) => {
      noise(c, o, 0, 0.25, 19, "lowpass", 3000, 600, 0.9, 0.005);
      noise(c, o, 0.1, 3.2, 23, "lowpass", 500, 60, 1.0, 0.3, 0.7, true);
    },
  },
  magic: {
    length: 1.4,
    build: (c, o) => {
      [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(c, o, "sine", i * 0.09, 0.6, f, f, 0.25));
      noise(c, o, 0, 1.0, 29, "highpass", 6000, 9000, 0.08, 0.05);
    },
  },
  bark: {
    length: 0.7,
    build: (c, o) => {
      for (const t0 of [0, 0.3]) {
        const osc = c.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(420, t0);
        osc.frequency.exponentialRampToValueAtTime(230, t0 + 0.14);
        const bq = c.createBiquadFilter();
        bq.type = "bandpass";
        bq.frequency.value = 900;
        bq.Q.value = 2;
        const g = c.createGain();
        env(g, t0, 0.01, 0.8, 0.16);
        osc.connect(bq).connect(g).connect(o);
        osc.start(t0);
        osc.stop(t0 + 0.25);
        noise(c, o, t0, 0.1, 31, "bandpass", 1200, 700, 0.3, 0.005, 2);
      }
    },
  },
  meow: {
    length: 0.9,
    build: (c, o) => {
      const osc = c.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(520, 0);
      osc.frequency.linearRampToValueAtTime(820, 0.25);
      osc.frequency.linearRampToValueAtTime(460, 0.75);
      const bq = c.createBiquadFilter();
      bq.type = "bandpass";
      bq.frequency.setValueAtTime(900, 0);
      bq.frequency.linearRampToValueAtTime(1800, 0.3);
      bq.frequency.linearRampToValueAtTime(800, 0.75);
      bq.Q.value = 3;
      const g = c.createGain();
      env(g, 0, 0.06, 0.7, 0.7);
      osc.connect(bq).connect(g).connect(o);
      osc.start(0);
      osc.stop(0.85);
    },
  },
  tweet: {
    length: 0.8,
    build: (c, o) => {
      [0, 0.18, 0.36].forEach((t0) => tone(c, o, "sine", t0, 0.1, 2600, 4200, 0.35, 0.003));
    },
  },
  honk: {
    length: 0.7,
    build: (c, o) => {
      tone(c, o, "square", 0, 0.5, 392, 392, 0.2, 0.02);
      tone(c, o, "square", 0, 0.5, 494, 494, 0.2, 0.02);
    },
  },
  footsteps: {
    length: 2.0,
    build: (c, o) => {
      for (let i = 0; i < 4; i++) noise(c, o, i * 0.45, 0.07, 41 + i, "lowpass", 700, 200, 0.7, 0.003);
    },
  },
  drumroll: {
    length: 2.2,
    build: (c, o) => {
      let t = 0;
      let gap = 0.09;
      let i = 0;
      while (t < 1.5) {
        noise(c, o, t, 0.05, 50 + i++, "bandpass", 300, 250, 0.45, 0.002, 1);
        t += gap;
        gap = Math.max(0.03, gap * 0.95);
      }
      noise(c, o, 1.55, 0.6, 99, "highpass", 5000, 3000, 0.6, 0.005);
      tone(c, o, "sine", 1.55, 0.3, 90, 50, 0.8);
    },
  },
  rain: { length: 4, build: (c, o, len) => noise(c, o, 0, len, 61, "lowpass", 5000, 3000, 0.28, 0.4, 0.5) },
  wind: {
    length: 4,
    build: (c, o, len) => {
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c, len, 67, true);
      const bq = c.createBiquadFilter();
      bq.type = "bandpass";
      bq.Q.value = 0.8;
      bq.frequency.value = 500;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.25;
      const depth = c.createGain();
      depth.gain.value = 250;
      lfo.connect(depth).connect(bq.frequency);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, 0);
      g.gain.exponentialRampToValueAtTime(0.9, 0.8);
      g.gain.setValueAtTime(0.9, Math.max(0.9, len - 0.8));
      g.gain.exponentialRampToValueAtTime(0.0001, len);
      src.connect(bq).connect(g).connect(o);
      src.start(0);
      lfo.start(0);
    },
  },
};

const AMBIENT = new Set<SoundKind>(["rain", "wind"]);
const cache = new Map<string, Promise<AudioBuffer>>();

/** Render a sound effect to a buffer (ambience lasts `duration`). Cached per kind and length. */
export function soundBuffer(kind: SoundKind, duration: number): Promise<AudioBuffer> {
  const recipe = RECIPES[kind];
  const len = AMBIENT.has(kind) ? Math.max(1, Math.min(120, duration)) : recipe.length;
  const key = `${kind}:${len.toFixed(2)}`;
  let job = cache.get(key);
  if (!job) {
    const ctx = new OfflineAudioContext(1, Math.ceil(len * SR), SR);
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    recipe.build(ctx, master, len);
    job = ctx.startRendering();
    cache.set(key, job);
  }
  return job;
}

export function soundLength(kind: SoundKind, duration: number): number {
  return AMBIENT.has(kind) ? duration : RECIPES[kind].length;
}
