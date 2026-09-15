// End-to-end check in a real browser: AI builds a scene, playback, export.
// Usage: node scripts/smoke.mjs <outDir> [prompt-index] [--no-review] [--no-ai]
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const out = resolve(process.argv[2] ?? "smoke-out");
const exampleIndex = Number(process.argv[3] ?? 0);
const review = !process.argv.includes("--no-review");
const useAi = !process.argv.includes("--no-ai");
const followIdx = process.argv.indexOf("--follow");
const followUp = followIdx > 0 ? process.argv[followIdx + 1] : null;
mkdirSync(out, { recursive: true });
const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
const browser = await puppeteer.launch({ executablePath: exe, headless: true, defaultViewport: { width: 1600, height: 950 }, args: ["--enable-unsafe-webgpu"] });
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
const cdp = await page.createCDPSession();
await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: out });

await page.goto("http://localhost:5178", { waitUntil: "networkidle0" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle0" });
await page.screenshot({ path: join(out, "1-empty.png") });
const t0 = Date.now();

if (useAi) {
  if (!review) await page.click(".composer label input");
  const promptIdx = process.argv.indexOf("--prompt");
  if (promptIdx > 0) {
    await page.type(".composer textarea", process.argv[promptIdx + 1]);
    await page.keyboard.press("Enter");
  } else {
    const buttons = await page.$$(".examples button");
    await buttons[exampleIndex].click();
  }
  await page.waitForSelector(".building", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 14000));
  await page.screenshot({ path: join(out, "2-working.png") });
  await page.waitForFunction(() => !document.querySelector(".building") && !document.querySelector(".msg.pending"), { timeout: 400000, polling: 1000 });
  console.log(`AI finished in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const msgs = await page.$$eval(".msg", (els) => els.map((e) => `[${e.className}] ${e.textContent}`));
  console.log(msgs.join("\n---\n"));
  if (followUp) {
    await page.screenshot({ path: join(out, "2b-first-result.png") });
    const t1 = Date.now();
    await page.type(".composer textarea", followUp);
    await page.keyboard.press("Enter");
    await page.waitForSelector(".building", { timeout: 10000 });
    await page.waitForFunction(() => !document.querySelector(".building") && !document.querySelector(".msg.pending"), { timeout: 400000, polling: 1000 });
    console.log(`follow-up finished in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
    const later = await page.$$eval(".msg", (els) => els.slice(-3).map((e) => `[${e.className}] ${e.textContent}`));
    console.log(later.join("\n---\n"));
  }
  await new Promise((r) => setTimeout(r, 1200));
  const saved = await page.evaluate(() => localStorage.getItem("stickman-studio.project"));
  writeFileSync(join(out, "scene.json"), saved ?? "{}");
} else {
  // Manual editing path: add a stick man and a box from the top bar.
  await page.click('button[title="Add a stick man"]');
  await page.click('button[title="Add a box"]');
  // Select the stick man and drag his right hand up with IK.
  await page.click('button[title="Add a stick man"]');
  const c = await (await page.$(".stage canvas")).boundingBox();
  const toClient = (x, y) => [c.x + (x * c.width) / 1280, c.y + (y * c.height) / 720];
  const [hx, hy] = toClient(640 + 22.6 * 1.25, 619 - 83.9 * 1.25);
  await page.mouse.move(hx, hy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(...toClient(668 + 5 * i, 514 - 12 * i));
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: join(out, "2-posed.png") });
  await page.mouse.move(...toClient(640, 560));
  await page.mouse.down();
  await page.mouse.move(...toClient(400, 560), { steps: 8 });
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: join(out, "2-moved.png") });
  await page.keyboard.down("Control");
  await page.keyboard.press("z");
  await page.keyboard.up("Control");
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: join(out, "2-undone.png") });
}

// Pause, jump to 60% of the timeline and screenshot.
await page.evaluate(() => document.querySelector(".transport .primary") && null);
await page.keyboard.press("Escape");
const dur = await page.$eval(".timecode", (e) => parseFloat(e.textContent.split("/")[1]));
const ruler = await page.$(".tl-ruler");
const box = await ruler.boundingBox();
await page.mouse.click(box.x + box.width * 0.55, box.y + 5);
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: join(out, "3-scrubbed.png") });

// Select the first character on the canvas via the timeline name list, and screenshot handles.
const names = await page.$$(".tl-name");
for (const n of names) {
  const text = await n.evaluate((e) => e.textContent);
  if (text.includes("🧍")) {
    await n.click();
    break;
  }
}
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: join(out, "4-selected.png") });

// Export.
const before = new Set(readdirSync(out));
await page.click(".topbar .primary");
const exportStart = Date.now();
// The summary dialog appears when the file is ready.
await page.waitForFunction(() => [...document.querySelectorAll(".modal h3")].some((h) => h.textContent.includes("Video exported") || h.textContent.includes("went wrong")), { timeout: 300000, polling: 500 });
console.log("export summary:", await page.$eval(".modal p", (p) => p.textContent));
let file;
for (let i = 0; i < 40 && !file; i++) {
  file = readdirSync(out).find((f) => !before.has(f) && /\.(mp4|webm)$/.test(f));
  if (!file) await new Promise((r) => setTimeout(r, 250));
}
console.log(`export (${dur}s video) took ${((Date.now() - exportStart) / 1000).toFixed(1)}s ->`, file);
console.log("console errors:", errors.length ? errors : "none");
await browser.close();
