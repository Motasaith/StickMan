// Browser check for the home page: AI feature cards, the live editor demo (sample project,
// playback, AI tools menu, demo limits, nothing saved) and opening it in the full editor.
// Usage: node scripts/home-ui.mjs <outDir>
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const out = resolve(process.argv[2] ?? "home-ui-out");
mkdirSync(out, { recursive: true });
const BASE = "http://localhost:5178";
const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
const browser = await puppeteer.launch({ executablePath: exe, headless: true, defaultViewport: { width: 1600, height: 1000 }, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));
page.on("pageerror", (e) => errors.push(`PAGE ${String(e).slice(0, 300)}`));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });
const click = (text, scope = "button") =>
  page.evaluate(
    (text, scope) => {
      const el = [...document.querySelectorAll(scope)].find((b) => b.textContent.replace(/\s+/g, " ").trim().includes(text) && !b.disabled);
      if (!el) throw new Error(`no enabled ${scope} with "${text}"`);
      el.click();
    },
    text,
    scope
  );
const store = (fn, arg) => page.evaluate(fn, arg);

const projectsBefore = (await (await fetch(`${BASE}/api/projects`)).json()).projects.length;
await page.goto(BASE, { waitUntil: "networkidle0" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle0" });
await page.evaluate(() => document.querySelector("#ai").scrollIntoView());
await wait(500);
await shot("1-ai-features");
await page.evaluate(() => document.querySelector("#demo").scrollIntoView());
await page.waitForFunction(() => window.__stickman?.useStore.getState().demo && document.querySelector("#demo main canvas"), { timeout: 30_000 });
await wait(2500);
console.log("demo", await store(() => { const s = window.__stickman.useStore.getState(); return { title: s.title, duration: s.scene.duration, assets: s.assets.length, projectId: s.projectId }; }));
await shot("2-demo");

// Play a few seconds.
await store(() => window.__stickman.useStore.getState().setPlaying(true));
await wait(3000);
await store(() => window.__stickman.useStore.getState().setPlaying(false));
console.log("played to", await store(() => window.__stickman.useStore.getState().time));

// AI tools menu, then jump to Draw with AI.
await click("AI tools");
await wait(600);
await shot("3-ai-tools");
await click("Draw with AI");
await wait(800);
console.log("left tab", await store(() => window.__stickman.useStore.getState().leftTab), "focused", await page.evaluate(() => document.activeElement?.hasAttribute("data-ai-draw")));
await shot("4-art-tab");
await click("AI tools");
await wait(400);
await click("YouTube kit");
await wait(1200);
await shot("5-youtube-kit");

// Limits: a fourth sticker is refused.
const results = await store(() => {
  const s = window.__stickman.useStore.getState();
  return [1, 2, 3, 4].map((i) => s.run([{ op: "sticker", id: `demo_s${i}`, emoji: "fire", x: 100 + i * 80, y: 200, size: 120, at: s.time }])[0]);
});
console.log("stickers", results.map((r) => r.ok));
await wait(800);
await shot("6-limit");
console.log("uses", await store(() => window.__stickman.useStore.getState().demoUses));
await store(() => window.__stickman.useStore.getState().setLeftTab("media"));
await wait(500);
const tiny = join(out, "tiny.png");
(await import("node:fs")).writeFileSync(tiny, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
const mediaBefore = await store(() => window.__stickman.useStore.getState().assets.length);
await (await page.$("#demo input[type=file]")).uploadFile(tiny);
await wait(2000);
const importErr = { assetsBefore: mediaBefore, assetsAfter: await store(() => window.__stickman.useStore.getState().assets.length), toast: await page.evaluate(() => document.querySelector("[data-sonner-toaster]")?.innerText.slice(0, 200)) };
await shot("6b-upload-refused");
console.log("upload in demo:", importErr);
await wait(2500);
const projectsMid = (await (await fetch(`${BASE}/api/projects`)).json()).projects.length;
console.log("projects unchanged while editing demo:", projectsMid === projectsBefore);

// Open in the full editor.
await click("Open in editor");
await page.waitForFunction(() => location.pathname.startsWith("/editor/"), { timeout: 30_000 });
await page.waitForFunction(() => window.__stickman?.useStore.getState().projectId && document.querySelector("main canvas"), { timeout: 30_000 });
await wait(3000);
console.log("editor", await store(() => { const s = window.__stickman.useStore.getState(); return { demo: s.demo, id: s.projectId, stickers: s.scene.objects.filter((o) => o.id.startsWith("demo_s")).length }; }));
await store(() => window.__stickman.useStore.getState().setLeftTab("illustrations"));
await wait(800);
await shot("7-editor-art");
await page.evaluate(async () => {
  const input = document.querySelector("input[placeholder^='Search: teeth']");
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  set.call(input, "zzqq spaceship");
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
await wait(500);
await shot("8-editor-art-empty");
// Clean up the project this check made.
const id = await store(() => window.__stickman.useStore.getState().projectId);
await page.goto(BASE, { waitUntil: "networkidle0" });
await fetch(`${BASE}/api/projects/${id}`, { method: "DELETE" });
console.log("errors", errors.slice(0, 12));
await browser.close();
