// Ask the AI for a 3D film, then save frames across its length and a summary of what it built.
// Usage: node scripts/ai-3d.mjs <outDir> "<prompt>"
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const out = resolve(process.argv[2] ?? "ai-3d");
const prompt = process.argv[3] ?? "Make a 3D film at sunset: a boy walks down a street past houses and trees to a bakery, and chats with the baker.";
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  defaultViewport: { width: 1600, height: 950 },
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto("http://localhost:5178", { waitUntil: "networkidle0" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle0" });
await page.waitForFunction(() => window.__stickman, { timeout: 20000 });

const t0 = Date.now();
await page.type(".composer textarea", prompt);
await page.keyboard.press("Enter");
await page.waitForSelector(".building", { timeout: 10000 });
await page.waitForFunction(() => !document.querySelector(".building") && !document.querySelector(".msg.pending"), { timeout: 600000, polling: 1000 });
console.log(`AI finished in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const msgs = await page.$$eval(".msg", (els) => els.map((e) => `[${e.className}] ${e.textContent}`));
console.log(msgs.join("\n---\n"));

const summary = await page.evaluate(() => {
  const { scene } = window.__stickman.useStore.getState();
  const count = {};
  for (const o of scene.objects) {
    const key = o.type === "drawing" ? (o.parts.some((p) => /3$/.test(p.kind)) ? "solid drawing" : "flat drawing") : o.type;
    count[key] = (count[key] ?? 0) + 1;
  }
  return {
    mode: scene.mode,
    lighting: scene.lighting,
    look3d: scene.look3d,
    duration: scene.duration,
    camera3dKeys: Object.fromEntries(Object.entries(scene.camera3d?.tracks ?? {}).map(([k, v]) => [k, v.length])),
    objects: count,
    names: scene.objects.map((o) => `${o.id}:${o.type}`).join(", "),
  };
});
console.log(JSON.stringify(summary, null, 2));
writeFileSync(join(out, "scene.json"), await page.evaluate(() => JSON.stringify(window.__stickman.useStore.getState().scene, null, 1)));

const duration = summary.duration;
const times = [0.3, 0.2, 0.4, 0.6, 0.8, 0.97].map((f, i) => (i === 0 ? 0.3 : duration * f));
for (const t of times) {
  await page.evaluate((t) => {
    const s = window.__stickman.useStore.getState();
    s.setPlaying(false);
    s.select(null);
    s.setTime(t);
  }, t);
  await new Promise((r) => setTimeout(r, 1200));
  const data = await page.$eval(".stage canvas", (c) => c.toDataURL("image/png"));
  writeFileSync(join(out, `t${t.toFixed(1)}.png`), Buffer.from(data.split(",")[1], "base64"));
}
await page.screenshot({ path: join(out, "ui.png") });
console.log("errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
