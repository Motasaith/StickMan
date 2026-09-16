// The media library on this computer: uploads, recordings, stock downloads and spoken lines.
// Files live in STICKMAN_DATA_DIR (default ~/.stickman-studio/media) with a small JSON beside
// each one, and are served with range requests so video seeks without downloading it all.

import { execFile, spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import { Readable } from "node:stream";
import { randomBytes } from "node:crypto";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";

const execFileAsync = promisify(execFile);

export const DATA_DIR = process.env.STICKMAN_DATA_DIR?.trim() || join(homedir(), ".stickman-studio");
export const MEDIA_DIR = join(DATA_DIR, "media");

export type MediaKind = "image" | "video" | "audio" | "svg";

export interface MediaInfo {
  id: string;
  file: string;
  name: string;
  kind: MediaKind;
  mime: string;
  w: number;
  h: number;
  duration?: number;
  hasAudio?: boolean;
  /** A strip of video frames (sprite url) for the timeline. */
  filmstrip?: string;
  frames?: number;
  /** Loudness peaks 0..1 for waveforms. */
  waveform?: number[];
  origin?: string;
  credit?: string;
  bytes: number;
}

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/mp4",
  ".mkv": "video/x-matroska",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".weba": "audio/webm",
  ".json": "application/json",
};

export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

function run(args: string[], timeoutMs = 600_000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg is not available on this computer"));
    const p = spawn(ffmpegPath as unknown as string, ["-v", "error", "-y", ...args], { windowsHide: true });
    let err = "";
    const timer = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.stderr.on("data", (d) => (err = (err + d.toString()).slice(-3000)));
    p.on("error", reject);
    p.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${err.trim().split("\n").slice(-3).join(" ")}`));
    });
  });
}

interface Probe {
  w: number;
  h: number;
  duration: number;
  video: string | null;
  audio: string | null;
  rotation: number;
}

export async function probe(file: string): Promise<Probe> {
  const args = ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file];
  // Windows sometimes fails the first spawn while the file is still settling: one retry.
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(ffprobe.path, args, { timeout: 30_000, maxBuffer: 8 * 1024 * 1024 }));
  } catch (err) {
    await new Promise((r) => setTimeout(r, 300));
    try {
      ({ stdout } = await execFileAsync(ffprobe.path, args, { timeout: 30_000, maxBuffer: 8 * 1024 * 1024 }));
    } catch {
      const detail = (err as Error).message.split("\n")[0].slice(-120);
      throw new Error(`Could not read that media file (${detail})`);
    }
  }
  const data = JSON.parse(stdout) as { streams?: Array<Record<string, unknown>>; format?: { duration?: string } };
  const streams = data.streams ?? [];
  const v = streams.find((s) => s.codec_type === "video" && (s.disposition as { attached_pic?: number } | undefined)?.attached_pic !== 1);
  const a = streams.find((s) => s.codec_type === "audio");
  const sideRot = ((v?.side_data_list as Array<{ rotation?: number }> | undefined) ?? []).find((d) => typeof d.rotation === "number")?.rotation;
  const tagRot = Number((v?.tags as { rotate?: string } | undefined)?.rotate ?? 0);
  const rotation = Math.abs(sideRot ?? tagRot ?? 0) % 180;
  let w = Number(v?.width ?? 0);
  let h = Number(v?.height ?? 0);
  if (rotation === 90) [w, h] = [h, w];
  return {
    w,
    h,
    duration: Number(data.format?.duration ?? v?.duration ?? a?.duration ?? 0) || 0,
    video: v ? String(v.codec_name) : null,
    audio: a ? String(a.codec_name) : null,
    rotation,
  };
}

async function writeMeta(info: MediaInfo) {
  await writeFile(join(MEDIA_DIR, `${info.id}.json`), JSON.stringify(info));
}

export async function mediaInfo(id: string): Promise<MediaInfo | null> {
  if (!/^[a-z]+_[0-9a-f]{12}$/.test(id)) return null;
  try {
    return JSON.parse(await readFile(join(MEDIA_DIR, `${id}.json`), "utf8")) as MediaInfo;
  } catch {
    return null;
  }
}

export function mediaUrl(file: string) {
  return `/api/media/${file}`;
}

const PLAYABLE_VIDEO = new Set(["h264", "vp8", "vp9", "av1"]);
const PLAYABLE_AUDIO = new Set(["aac", "mp3", "opus", "vorbis", "pcm_s16le", "pcm_f32le", "flac"]);

/**
 * Store a file in the library. Videos browsers can't play (iPhone HEVC, .mov, .mkv) are
 * converted to H.264 MP4; odd audio becomes AAC. Returns the stored media's info.
 */
export async function importMedia(bytes: Buffer, originalName: string, opts: { origin?: string; credit?: string } = {}): Promise<MediaInfo> {
  await mkdir(MEDIA_DIR, { recursive: true });
  if (bytes.length > MAX_UPLOAD_BYTES) throw new Error("That file is over 300 MB.");
  let ext = extname(originalName).toLowerCase() || ".bin";
  if (ext === ".jpeg") ext = ".jpg";
  const isSvg = ext === ".svg" || bytes.subarray(0, 512).toString("utf8").includes("<svg");
  const tmpId = newId("tmp");
  const tmp = join(MEDIA_DIR, `${tmpId}${isSvg ? ".svg" : ext}`);
  await writeFile(tmp, bytes);
  const name = originalName.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120) || "media";
  try {
    if (isSvg) {
      const id = newId("svg");
      const file = `${id}.svg`;
      await rename(tmp, join(MEDIA_DIR, file));
      const text = bytes.toString("utf8");
      const vb = text.match(/viewBox\s*=\s*["']([^"']+)["']/)?.[1]?.split(/[\s,]+/).map(Number);
      const info: MediaInfo = { id, file, name, kind: "svg", mime: MIME[".svg"], w: vb?.[2] || 400, h: vb?.[3] || 400, bytes: bytes.length, ...opts };
      await writeMeta(info);
      return info;
    }
    const p = await probe(tmp);
    const looksImage = [".png", ".jpg", ".webp", ".gif"].includes(ext) || (p.video && (p.duration === 0 || ["png", "mjpeg", "webp"].includes(p.video)) && !p.audio);
    if (looksImage && p.w) {
      const id = newId("img");
      const file = `${id}${ext === ".bin" ? ".png" : ext}`;
      await rename(tmp, join(MEDIA_DIR, file));
      const info: MediaInfo = { id, file, name, kind: "image", mime: MIME[extname(file)] ?? "image/png", w: p.w, h: p.h, bytes: bytes.length, ...opts };
      await writeMeta(info);
      return info;
    }
    if (p.video && p.w) {
      const id = newId("vid");
      const okContainer = ext === ".mp4" || ext === ".webm" || ext === ".m4v";
      const needs = !okContainer || !PLAYABLE_VIDEO.has(p.video) || (p.audio !== null && !PLAYABLE_AUDIO.has(p.audio)) || p.rotation === 90;
      let file = `${id}${ext === ".m4v" ? ".mp4" : ext}`;
      if (needs) {
        file = `${id}.mp4`;
        await run(["-i", tmp, "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-vf", "scale='min(1920,iw)':-2", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", join(MEDIA_DIR, file)]);
        await rm(tmp, { force: true });
      } else await rename(tmp, join(MEDIA_DIR, file));
      const final = needs ? await probe(join(MEDIA_DIR, file)) : p;
      const info: MediaInfo = { id, file, name, kind: "video", mime: MIME[extname(file)] ?? "video/mp4", w: final.w, h: final.h, duration: final.duration, hasAudio: !!final.audio, bytes: (await stat(join(MEDIA_DIR, file))).size, ...opts };
      await Promise.all([makeFilmstrip(info).catch(() => {}), info.hasAudio ? makeWaveform(info).catch(() => {}) : Promise.resolve()]);
      await writeMeta(info);
      return info;
    }
    if (p.audio) {
      const id = newId("aud");
      const okAudio = [".mp3", ".wav", ".m4a", ".ogg", ".webm", ".weba", ".opus", ".aac"].includes(ext) && PLAYABLE_AUDIO.has(p.audio);
      let file = `${id}${ext === ".webm" ? ".weba" : ext}`;
      if (!okAudio) {
        file = `${id}.m4a`;
        await run(["-i", tmp, "-vn", "-c:a", "aac", "-b:a", "160k", join(MEDIA_DIR, file)]);
        await rm(tmp, { force: true });
      } else await rename(tmp, join(MEDIA_DIR, file));
      const final = okAudio ? p : await probe(join(MEDIA_DIR, file));
      const info: MediaInfo = { id, file, name, kind: "audio", mime: MIME[extname(file)] ?? "audio/mpeg", w: 0, h: 0, duration: final.duration, hasAudio: true, bytes: (await stat(join(MEDIA_DIR, file))).size, ...opts };
      await makeWaveform(info).catch(() => {});
      await writeMeta(info);
      return info;
    }
    throw new Error("That file isn't a picture, video or sound this editor can use.");
  } catch (err) {
    await rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}

async function makeFilmstrip(info: MediaInfo) {
  const frames = Math.max(4, Math.min(24, Math.round((info.duration ?? 4) / 1.5)));
  const out = `${info.id}_strip.jpg`;
  const every = Math.max(0.05, (info.duration ?? 4) / frames);
  await run(["-i", join(MEDIA_DIR, info.file), "-vf", `fps=1/${every.toFixed(3)},scale=160:-2,tile=${frames}x1`, "-frames:v", "1", "-q:v", "5", join(MEDIA_DIR, out)], 120_000);
  info.filmstrip = mediaUrl(out);
  info.frames = frames;
}

async function makeWaveform(info: MediaInfo) {
  const pcm = await new Promise<Buffer>((resolve, reject) => {
    const p = spawn(ffmpegPath as unknown as string, ["-v", "error", "-i", join(MEDIA_DIR, info.file), "-vn", "-ac", "1", "-ar", "2000", "-f", "s16le", "pipe:1"], { windowsHide: true });
    const chunks: Buffer[] = [];
    p.stdout.on("data", (d) => chunks.push(d));
    p.on("error", reject);
    p.on("close", () => resolve(Buffer.concat(chunks)));
  });
  const samples = Math.floor(pcm.length / 2);
  if (!samples) return;
  const bins = Math.max(50, Math.min(1200, Math.round((info.duration ?? 1) * 20)));
  const per = Math.max(1, Math.floor(samples / bins));
  const peaks: number[] = [];
  let max = 1;
  for (let b = 0; b < bins; b++) {
    let peak = 0;
    for (let i = b * per; i < Math.min(samples, (b + 1) * per); i++) peak = Math.max(peak, Math.abs(pcm.readInt16LE(i * 2)));
    peaks.push(peak);
    max = Math.max(max, peak);
  }
  info.waveform = peaks.map((p) => Math.round((p / max) * 100) / 100);
}

/** Serve a stored file, honoring Range so video can seek. */
export async function serveMedia(file: string, rangeHeader: string | undefined): Promise<Response> {
  if (!/^[a-z]+_[0-9a-f]{12}(_strip)?\.[a-z0-9]+$/.test(file)) return new Response("Not found", { status: 404 });
  const path = join(MEDIA_DIR, file);
  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const type = MIME[extname(file)] ?? "application/octet-stream";
  const headers: Record<string, string> = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=31536000, immutable" };
  const m = rangeHeader?.match(/bytes=(\d*)-(\d*)/);
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.min(start, size - 1);
    end = Math.min(end, size - 1);
    return new Response(Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, { status: 200, headers: { ...headers, "Content-Length": String(size) } });
}

export async function mediaPath(id: string): Promise<string | null> {
  const info = await mediaInfo(id);
  return info ? join(MEDIA_DIR, info.file) : null;
}

/** Media id from a library URL like /api/media/vid_0123456789ab.mp4. */
export function idFromUrl(url: string): string | null {
  return url.match(/\/api\/media\/([a-z]+_[0-9a-f]{12})\.[a-z0-9]+$/)?.[1] ?? null;
}
