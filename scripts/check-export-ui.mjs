// Export through the real Export button (voices recorded, 3D, sound effects, AAC finishing)
// and save the downloaded file. Usage: node scripts/check-export-ui.mjs <outDir> [chrome|firefox]
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const out = resolve(process.argv[2] ?? "check-export-ui");
const which = process.argv[3] ?? "chrome";
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch(
  which === "firefox"
    ? { browser: "firefox", executablePath: "C:/Program Files/Mozilla Firefox/firefox.exe", headless: true, defaultViewport: { width: 1500, height: 900 } }
    : { executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, defaultViewport: { width: 1500, height: 900 }, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }
);
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://localhost:5178", { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load" });
await page.waitForFunction(() => window.__stickman, { timeout: 20000 });
await page.evaluate(() => {
  // Capture the download instead of saving it.
  window.__download = null;
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) window.__download = { href: this.href, name: this.download };
    else click.call(this);
  };
  const { useStore } = window.__stickman;
  useStore.getState().run([
    { op: "scene", mode: "3d", duration: 4, background: "#bfe3ff", floor: "#cfe8b0" },
    { op: "draw", id: "ball", x: 700, y: 600, z: 100, parts: [{ kind: "sphere3", cx: 0, cy: -20, r: 20, fill: "#ff595e" }] },
    { op: "character", id: "bob", x: 450, look: { hat: "tophat", shirt: "#3a86ff" }, voice: "man" },
    { op: "creature", id: "rex", species: "dog", x: 850, z: 150, facing: "left" },
    { op: "say", character: "bob", text: "Watch this ball bounce!", at: 0.3 },
    { op: "bounce", id: "ball", at: 1.5, height: 140, times: 2 },
    { op: "sound", kind: "boing", at: 1.5 },
    { op: "sound", kind: "bark", at: 2.8 },
    { op: "orbit", degrees: 40, at: 0, duration: 4 },
  ]);
});
const t0 = Date.now();
await page.click(".topbar .primary");
await page.waitForFunction(() => window.__download, { timeout: 300000, polling: 500 });
const summary = await page.$eval(".modal p", (p) => p.textContent).catch(() => "(no summary)");
const file = await page.evaluate(async () => {
  const blob = await fetch(window.__download.href).then((r) => r.blob());
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { name: window.__download.name, b64: btoa(bin) };
});
writeFileSync(join(out, `${which}-${file.name}`), Buffer.from(file.b64, "base64"));
console.log(which, `export took ${((Date.now() - t0) / 1000).toFixed(1)}s ->`, `${which}-${file.name}`);
console.log(which, "summary:", summary);
console.log(which, "errors:", errors.length ? errors : "none");
await browser.close();
