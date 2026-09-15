// Export a sample scene in Firefox and Chrome through every encoder path and save the files.
// Usage: node scripts/export-check.mjs <outDir>   (dev server must be running)
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const out = resolve(process.argv[2] ?? "export-check");
mkdirSync(out, { recursive: true });
const browsers = [
  { name: "firefox", browser: "firefox", executablePath: "C:/Program Files/Mozilla Firefox/firefox.exe" },
  { name: "chrome", browser: "chrome", executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" },
].filter((b) => existsSync(b.executablePath));

for (const b of browsers) {
  const browser = await puppeteer.launch({ browser: b.browser, executablePath: b.executablePath, headless: true });
  const page = await browser.newPage();
  await page.goto("http://localhost:5178", { waitUntil: "load" });
  for (const mode of ["default", "avc", "webm"]) {
    const started = Date.now();
    const res = await page.evaluate(async (mode) => {
      const { applyOps } = await import("/src/engine/ops.ts");
      const { emptyScene } = await import("/src/engine/scene.ts");
      const { exportVideo } = await import("/src/export.ts");
      const { applyOps: _a } = await import("/src/engine/ops.ts");
      const scene0 = _a(emptyScene(), [
        { op: "draw", id: "board", x: 640, y: 110, parts: [{ kind: "rect", x: 0, y: 0, w: 520, h: 300, fill: "#2f4f3a", stroke: "#8b5a2b", width: 14 }] },
        { op: "character", id: "t", x: 150 },
        { op: "write", id: "t", on: "board", text: "2+2=4", at: 0.2 },
        { op: "say", id: "line", character: "t", text: "Two plus two is four.", at: 0.5 },
        { op: "creature", id: "dog", species: "dog", x: 1000 },
        { op: "effect", id: "fx", kind: "confetti", at: 1 },
      ]).scene;
      // Give the line a real voice, as the editor does.
      const tts = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "Two plus two is four.", voice: "man" }) }).then((r) => r.json());
      const assets = [{ id: "voice1", name: "voice", src: tts.audio, w: 0, h: 0, kind: "audio", duration: 2 }];
      const line = scene0.objects.find((o) => o.id === "line");
      line.audio = { asset: "voice1", at: 0.5, duration: 2, envelope: [0.2, 0.8, 0.5], rate: 30, text: line.text, voice: "man" };
      const scene = scene0;
      scene.duration = 3;
      const saved = window.VideoEncoder;
      if (mode === "webm") window.VideoEncoder = undefined;
      try {
        const r = await exportVideo(scene, assets, () => {}, new AbortController().signal, mode === "avc" ? { avcFormat: "avc" } : {});
        const buf = new Uint8Array(await r.blob.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        return { ext: r.ext, b64: btoa(bin) };
      } catch (e) {
        return { error: String(e && e.stack || e) };
      } finally {
        window.VideoEncoder = saved;
      }
    }, mode);
    if (res.error) {
      console.log(`${b.name} ${mode}: FAILED ${res.error}`);
      continue;
    }
    const file = join(out, `${b.name}-${mode}.${res.ext}`);
    writeFileSync(file, Buffer.from(res.b64, "base64"));
    console.log(`${b.name} ${mode}: ${res.ext} ${Math.round(Buffer.from(res.b64, "base64").length / 1024)}KB in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${file}`);
  }
  await browser.close();
}
