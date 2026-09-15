// Render the scene frame by frame and encode an MP4 in the browser (WebCodecs + mp4-muxer).
// Falls back to a real-time WebM recording where WebCodecs H.264 isn't available.

import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import type { Asset, Scene } from "./engine/scene";
import { renderScene, type RenderOptions } from "./engine/render";
import { canvasPool, exportVideoLookup, preloadImages, preloadSvgs, seekVideos, videoLookup } from "./runtime/media";
import { buildAvcC, naluType, splitNalus, toLengthPrefixed } from "./avc";
import { audioContext, mixSceneAudio } from "./audio";
import { render3D } from "./render3d";

type AudioChoice = { config: AudioEncoderConfig; muxCodec: "aac" | "opus" };

async function pickAudio(sampleRate: number, channels: number): Promise<AudioChoice | null> {
  if (typeof AudioEncoder === "undefined") return null;
  const options: AudioChoice[] = [
    { config: { codec: "mp4a.40.2", sampleRate, numberOfChannels: channels, bitrate: 128_000 }, muxCodec: "aac" },
    { config: { codec: "opus", sampleRate, numberOfChannels: channels, bitrate: 128_000 }, muxCodec: "opus" },
  ];
  for (const o of options) {
    try {
      if ((await AudioEncoder.isConfigSupported(o.config)).supported) return o;
    } catch {
      /* try the next codec */
    }
  }
  return null;
}

export interface ExportResult {
  blob: Blob;
  ext: "mp4" | "webm";
  /** Codec of the sound track, or null when the video is silent. */
  audio: "aac" | "opus" | null;
  /** Something the user should know about the file. */
  note?: string;
}

function avcLevel(w: number, h: number) {
  const px = w * h;
  if (px <= 921_600) return "1f";
  if (px <= 2_088_960) return "28";
  return "33";
}

async function pickCodec(w: number, h: number, fps: number, bitrate: number): Promise<VideoEncoderConfig | null> {
  if (typeof VideoEncoder === "undefined") return null;
  const level = avcLevel(w, h);
  // Baseline first: it has no B-frames, so every encoder emits frames in display order
  // (Firefox's High-profile encoder reorders them, which an MP4 sample table can't take as-is).
  for (const profile of ["4200", "4d00", "6400"]) {
    const config: VideoEncoderConfig = { codec: `avc1.${profile}${level}`, width: w, height: h, bitrate, framerate: fps };
    try {
      const support = await VideoEncoder.isConfigSupported(config);
      if (support.supported) return config;
    } catch {
      /* try the next profile */
    }
  }
  return null;
}

export async function exportVideo(
  scene: Scene,
  assets: Asset[],
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
  /** For testing the encoder paths: force the H.264 output format. */
  options: { avcFormat?: "avc" | "annexb" } = {}
): Promise<ExportResult> {
  const pool = canvasPool();
  const opts: FrameOptions = {
    images: await preloadImages(assets),
    svgs: await preloadSvgs(scene, assets),
    videoFrame: exportVideoLookup(assets),
    makeCanvas: pool,
    threeD: render3D,
    prepare: scene.objects.some((o) => o.type === "video") ? (t) => seekVideos(scene, t, assets) : undefined,
    reset: () => pool.reset(),
    assets,
  };
  const w = scene.width - (scene.width % 2);
  const h = scene.height - (scene.height % 2);
  const fps = scene.fps;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const frames = Math.max(1, Math.ceil(scene.duration * fps));
  const bitrate = Math.max(2_000_000, Math.round(w * h * fps * 0.2));

  const soundtrack = await mixSceneAudio(scene, assets).catch(() => null);
  const audio = soundtrack ? await pickAudio(soundtrack.sampleRate, soundtrack.numberOfChannels) : null;
  const config = await pickCodec(w, h, fps, bitrate);
  // No H.264, or a soundtrack this browser can't encode for MP4: record WebM (with sound) instead.
  if (!config || (soundtrack && !audio)) return recordWebm(scene, canvas, ctx, opts, onProgress, signal, soundtrack);
  // Annex B keeps the SPS/PPS inside every keyframe, so the MP4 header is built from the
  // stream itself. Firefox's own `description` doesn't always match its stream.
  config.avc = { format: options.avcFormat ?? "annexb" };

  try {
    return await encodeMp4(scene, canvas, ctx, opts, config, frames, onProgress, signal, soundtrack && audio ? { buffer: soundtrack, choice: audio } : null);
  } catch (err) {
    // The encoder gave us nothing an MP4 can be built from: record WebM instead of failing.
    if ([NO_DECODER_CONFIG, REORDERED].includes((err as Error).message)) return recordWebm(scene, canvas, ctx, opts, onProgress, signal, soundtrack);
    throw err;
  }
}

/** Everything a frame needs: media lookups, and a hook to get videos to the right frame first. */
interface FrameOptions extends RenderOptions {
  prepare?: (t: number) => Promise<void>;
  reset: () => void;
  assets: Asset[];
}

async function drawFrame(ctx: CanvasRenderingContext2D, scene: Scene, t: number, opts: FrameOptions) {
  if (opts.prepare) await opts.prepare(t);
  opts.reset();
  renderScene(ctx, scene, t, opts);
}

const NO_DECODER_CONFIG = "The video encoder did not provide H.264 stream settings";
const REORDERED = "The video encoder emitted frames out of order";

async function encodeMp4(
  scene: Scene,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  opts: FrameOptions,
  config: VideoEncoderConfig,
  frames: number,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
  sound: { buffer: AudioBuffer; choice: AudioChoice } | null
): Promise<ExportResult> {
  const { width: w, height: h, framerate } = config;
  const fps = framerate ?? scene.fps;
  const frameDur = 1_000_000 / fps;
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width: w, height: h, frameRate: fps },
    ...(sound ? { audio: { codec: sound.choice.muxCodec, sampleRate: sound.buffer.sampleRate, numberOfChannels: sound.buffer.numberOfChannels } } : {}),
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  let failure: Error | null = null;
  let haveConfig = false;
  let lastTimestamp = -Infinity;

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      if (failure) return;
      try {
        if (chunk.timestamp < lastTimestamp) throw new Error(REORDERED);
        lastTimestamp = chunk.timestamp;
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        const { format, nalus } = splitNalus(data);
        let decoderConfig = meta?.decoderConfig;
        if (!haveConfig && chunk.type === "key") {
          // Prefer an avcC built from the SPS/PPS inside the keyframe: it always matches the stream.
          const sps = nalus.find((n) => naluType(n) === 7);
          const pps = nalus.filter((n) => naluType(n) === 8);
          if (sps && pps.length) {
            decoderConfig = { ...decoderConfig, codec: decoderConfig?.codec ?? config.codec, codedWidth: w, codedHeight: h, description: buildAvcC(sps, pps) };
            haveConfig = true;
          } else if (decoderConfig?.description && format === "avcc") {
            haveConfig = true;
          }
        } else if (haveConfig) {
          decoderConfig = undefined;
        }
        if (!haveConfig) throw new Error(NO_DECODER_CONFIG);
        const payload = format === "annexb" ? toLengthPrefixed(nalus) : data;
        muxer.addVideoChunkRaw(payload, chunk.type, chunk.timestamp, chunk.duration ?? frameDur, decoderConfig ? { decoderConfig } : undefined);
      } catch (e) {
        failure = e as Error;
      }
    },
    error: (e) => (failure = e),
  });
  encoder.configure(config);

  const stop = () => {
    if (encoder.state !== "closed") encoder.close();
  };
  for (let i = 0; i < frames; i++) {
    if (signal.aborted) {
      stop();
      throw new DOMException("Export cancelled", "AbortError");
    }
    if (failure) {
      stop();
      throw failure;
    }
    await drawFrame(ctx, scene, i / fps, opts);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameDur), duration: Math.round(frameDur) });
    encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 1));
    if (i % 5 === 0) {
      onProgress(i / frames);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  await encoder.flush();
  stop();
  if (failure) throw failure;
  if (!haveConfig) throw new Error(NO_DECODER_CONFIG);
  if (sound) await encodeSoundtrack(muxer, sound.buffer, sound.choice, signal);
  muxer.finalize();
  onProgress(1);
  return { blob: new Blob([target.buffer], { type: "video/mp4" }), ext: "mp4", audio: sound ? sound.choice.muxCodec : null };
}

async function encodeSoundtrack(muxer: Muxer<ArrayBufferTarget>, buffer: AudioBuffer, choice: AudioChoice, signal: AbortSignal) {
  let failure: Error | null = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => (failure = e),
  });
  encoder.configure(choice.config);
  const channels = buffer.numberOfChannels;
  const block = 4800;
  const planes = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  for (let i = 0; i < buffer.length; i += block) {
    if (signal.aborted) break;
    if (failure) throw failure;
    const n = Math.min(block, buffer.length - i);
    const data = new Float32Array(n * channels);
    for (let c = 0; c < channels; c++) data.set(planes[c].subarray(i, i + n), c * n);
    const frame = new AudioData({ format: "f32-planar", sampleRate: buffer.sampleRate, numberOfFrames: n, numberOfChannels: channels, timestamp: Math.round((i / buffer.sampleRate) * 1e6), data });
    encoder.encode(frame);
    frame.close();
    while (encoder.encodeQueueSize > 20) await new Promise((r) => setTimeout(r, 1));
  }
  await encoder.flush();
  encoder.close();
  if (failure) throw failure;
}

async function recordWebm(
  scene: Scene,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  opts: FrameOptions,
  onProgress: (f: number) => void,
  signal: AbortSignal,
  soundtrack: AudioBuffer | null = null
): Promise<ExportResult> {
  const stream = canvas.captureStream(scene.fps);
  let soundSource: AudioBufferSourceNode | null = null;
  if (soundtrack) {
    const ac = audioContext();
    if (ac.state === "suspended") await ac.resume();
    const dest = ac.createMediaStreamDestination();
    soundSource = ac.createBufferSource();
    soundSource.buffer = soundtrack;
    soundSource.connect(dest);
    for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);
  }
  const types = soundtrack ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"] : ["video/webm;codecs=vp9", "video/webm"];
  const recorder = new MediaRecorder(stream, { mimeType: types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm" });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (recorder.onstop = () => r()));
  recorder.start();
  soundSource?.start();
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      opts.reset();
      renderScene(ctx, scene, Math.min(t, scene.duration), { ...opts, videoFrame: videoLookup(opts.assets, true) });
      onProgress(Math.min(1, t / scene.duration));
      if (t >= scene.duration || signal.aborted) resolve();
      else requestAnimationFrame(tick);
    };
    tick();
  });
  recorder.stop();
  try {
    soundSource?.stop();
  } catch {
    /* already finished */
  }
  await done;
  if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
  return { blob: new Blob(chunks, { type: "video/webm" }), ext: "webm", audio: soundtrack ? "opus" : null };
}

/** Make the file play with sound everywhere (AAC in MP4). Returns the original if the server can't. */
export async function finalizeForPlayers(result: ExportResult): Promise<ExportResult> {
  if (result.ext === "mp4" && result.audio !== "opus") return result;
  try {
    const res = await fetch(`/api/export/finalize?ext=${result.ext}`, { method: "POST", body: result.blob, headers: { "Content-Type": "application/octet-stream" } });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `error ${res.status}`);
    return { blob: await res.blob(), ext: "mp4", audio: result.audio ? "aac" : null };
  } catch (err) {
    return { ...result, note: `The sound couldn't be converted for every player (${(err as Error).message}), so some players may show it silent. VLC plays it.` };
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
