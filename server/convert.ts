// Other downloads made from a finished MP4, as in PromptCut: a part of it, another frame rate,
// a smaller file, a GIF, the sound as MP3, or a cover picture.

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { probe } from "./media";

export const EXPORT_FORMATS = ["mp4", "gif", "mp3", "cover"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export const MAX_GIF_SECONDS = 20;

export interface ConvertOptions {
  format: ExportFormat;
  start?: number;
  end?: number;
  fps?: 24 | 25 | 30 | 60;
  size?: "small" | "full";
  /** Cover: the second to take the picture from. */
  at?: number;
}

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg is not available on this computer"));
    const p = spawn(ffmpegPath as unknown as string, ["-v", "error", "-y", ...args], { windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => (err = (err + d.toString()).slice(-2000)));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${err.trim().split("\n").slice(-3).join(" ")}`))));
  });
}

export async function convertExport(input: Buffer, o: ConvertOptions): Promise<{ bytes: Buffer; ext: string; mime: string }> {
  const dir = await mkdtemp(join(tmpdir(), "stickman-convert-"));
  try {
    const src = join(dir, "in.mp4");
    await writeFile(src, input);
    const { duration } = await probe(src);
    const start = Math.min(Math.max(0, o.start ?? 0), Math.max(0, duration - 0.3));
    const end = Math.min(duration, o.end ?? duration);
    if (o.format !== "cover" && end - start < 0.3) throw new Error("The part to keep must be at least a third of a second long.");
    const range = start > 0 || end < duration - 0.01 ? ["-ss", start.toFixed(3), "-to", end.toFixed(3)] : [];
    switch (o.format) {
      case "cover": {
        const out = join(dir, "cover.jpg");
        await run(["-ss", Math.min(Math.max(0, o.at ?? 0), Math.max(0, duration - 0.05)).toFixed(3), "-i", src, "-frames:v", "1", "-q:v", "2", out]);
        return { bytes: await readFile(out), ext: "jpg", mime: "image/jpeg" };
      }
      case "mp3": {
        const out = join(dir, "sound.mp3");
        await run([...range, "-i", src, "-vn", "-c:a", "libmp3lame", "-b:a", "192k", out]);
        return { bytes: await readFile(out), ext: "mp3", mime: "audio/mpeg" };
      }
      case "gif": {
        if (end - start > MAX_GIF_SECONDS + 0.01) throw new Error(`A GIF can be at most ${MAX_GIF_SECONDS} seconds. Choose a shorter part.`);
        const out = join(dir, "video.gif");
        const width = o.size === "small" ? 320 : 480;
        const vf = `fps=12,scale=${width}:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`;
        await run([...range, "-i", src, "-filter_complex", vf, "-loop", "0", out]);
        return { bytes: await readFile(out), ext: "gif", mime: "image/gif" };
      }
      case "mp4": {
        const out = join(dir, "out.mp4");
        const filters = [...(o.fps ? [`fps=${o.fps}`] : []), ...(o.size === "small" ? ["scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)'"] : [])];
        const reencode = filters.length > 0 || range.length > 0;
        await run([
          ...range,
          "-i",
          src,
          ...(filters.length ? ["-vf", filters.join(",")] : []),
          ...(reencode ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", o.size === "small" ? "28" : "20", "-pix_fmt", "yuv420p"] : ["-c:v", "copy"]),
          "-c:a",
          "aac",
          "-b:a",
          o.size === "small" ? "96k" : "160k",
          "-movflags",
          "+faststart",
          out,
        ]);
        return { bytes: await readFile(out), ext: "mp4", mime: "video/mp4" };
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
