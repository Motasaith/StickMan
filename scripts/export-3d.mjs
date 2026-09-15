// Export a lit 3D scene with props and the auto director to MP4 in Chrome and save the file.
// Usage: node scripts/export-3d.mjs <outDir>   (dev server must be running)
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const out = resolve(process.argv[2] ?? "export-3d");
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
await page.goto("http://localhost:5178", { waitUntil: "load" });
const started = Date.now();
const res = await page.evaluate(async () => {
  const { applyOps } = await import("/src/engine/ops.ts");
  const { emptyScene } = await import("/src/engine/scene.ts");
  const { exportVideo } = await import("/src/export.ts");
  const scene = applyOps(emptyScene(), [
    { op: "scene", mode: "3d", lighting: "golden", duration: 4 },
    { op: "prop", id: "road", kind: "road", x: 640, z: 200 },
    { op: "prop", id: "home", kind: "house", x: 350, z: -450 },
    { op: "prop", id: "shop", kind: "shop", x: 950, z: -450, text: "BAKERY" },
    { op: "prop", id: "tree", kind: "tree", x: 650, z: -300 },
    { op: "prop", id: "lamp", kind: "streetlight", x: 800, z: -120 },
    { op: "character", id: "ali", x: 300, z: 40 },
    { op: "character", id: "zara", x: 900, z: 20, facing: "left" },
    { op: "walk", id: "ali", to: "zara", at: 0.2 },
    { op: "say", character: "zara", text: "Hi Ali!", at: 2.6, duration: 1.2, voice: "none" },
    { op: "sound", kind: "ding", at: 2.6 },
    { op: "direct" },
  ]).scene;
  const r = await exportVideo(scene, [], () => {}, new AbortController().signal, {});
  const buf = new Uint8Array(await r.blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { ext: r.ext, audio: r.audio, b64: btoa(bin) };
});
const file = join(out, `street-3d.${res.ext}`);
writeFileSync(file, Buffer.from(res.b64, "base64"));
console.log(`${res.ext} audio=${res.audio} ${Math.round(Buffer.from(res.b64, "base64").length / 1024)}KB in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${file}`);
await browser.close();
