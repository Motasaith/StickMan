// Turns a browser-made video into an MP4 that plays everywhere: H.264 video with AAC sound.
// Browsers without an AAC encoder (Firefox) write Opus or WebM, which many players show silent.

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg is not available on this computer"));
    const p = spawn(ffmpegPath as unknown as string, args, { windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => (err = (err + d.toString()).slice(-2000)));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${err.split("\n").slice(-4).join(" ")}`))));
  });
}

export async function finalizeVideo(input: Buffer, ext: "mp4" | "webm"): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "stickman-export-"));
  try {
    const src = join(dir, `in.${ext}`);
    const out = join(dir, "out.mp4");
    await writeFile(src, input);
    // MP4 from the browser already has H.264 video, so only the sound is re-encoded.
    const video = ext === "mp4" ? ["-c:v", "copy"] : ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"];
    await run(["-y", "-i", src, "-map", "0:v:0", "-map", "0:a?", ...video, "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out]);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
