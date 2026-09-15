// Browser walk-through of the pro editor: projects page, presentation template, left tabs,
// adding stickers/illustrations/text, timeline, inspector and playback.
// Usage: node scripts/pro-ui.mjs <outDir>
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const out = resolve(process.argv[2] ?? "pro-ui-out");
mkdirSync(out, { recursive: true });
const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
const browser = await puppeteer.launch({ executablePath: exe, headless: true, defaultViewport: { width: 1600, height: 950 } });
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });

/** Click the first button whose visible text includes `text`. */
async function clickText(text, scope = "button") {
  const ok = await page.evaluate(
    (text, scope) => {
      const el = [...document.querySelectorAll(scope)].find((b) => b.textContent.replace(/\s+/g, " ").trim().includes(text));
      if (!el) return false;
      el.click();
      return true;
    },
    text,
    scope,
  );
  if (!ok) throw new Error(`no button with "${text}"`);
  await wait(400);
}
const state = () => page.evaluate(() => {
  const s = window.__stickman.useStore.getState();
  return { objects: s.scene.objects.map((o) => o.type + ":" + (o.src ?? o.kind ?? o.text ?? "")), slides: (s.scene.slides ?? []).length, duration: s.scene.duration, selected: s.selectedId, assets: s.assets.length };
});

await page.goto("http://localhost:5178", { waitUntil: "networkidle0" });
await shot("1-projects");

await clickText("A narrated slide deck");
await page.waitForFunction(() => location.pathname.startsWith("/editor/"), { timeout: 15000 });
await page.waitForSelector("canvas", { timeout: 15000 });
await wait(2500);
await shot("2-deck-editor");
console.log("deck", await state());

// Scrub to the middle of slide 2.
await page.evaluate(() => {
  const s = window.__stickman.useStore.getState();
  const sl = s.scene.slides[1];
  s.setTime(sl.start + sl.duration * 0.6);
});
await wait(800);
await shot("3-slide2");

for (const tab of ["Art", "Stickers", "Text", "Shapes", "People", "Effects", "Sounds", "Media", "Stock", "3D", "Record", "Slides"]) {
  await page.evaluate((tab) => {
    const b = [...document.querySelectorAll("aside nav button")].find((x) => x.textContent.trim() === tab);
    b.click();
  }, tab);
  await wait(500);
  await shot(`tab-${tab.toLowerCase()}`);
}

// Blank project: add things from the panels.
await page.goto("http://localhost:5178", { waitUntil: "networkidle0" });
await clickText("Start empty");
await page.waitForFunction(() => location.pathname.startsWith("/editor/"), { timeout: 15000 });
await page.waitForSelector("canvas");
await wait(1500);
await page.evaluate(() => window.__stickman.useStore.getState().setLeftTab("illustrations"));
await wait(600);
const tiles = await page.$$("aside button img");
if (tiles.length) await tiles[0].click();
await wait(500);
await page.evaluate(() => window.__stickman.useStore.getState().setLeftTab("stickers"));
await wait(600);
const st = await page.$$("aside button img");
if (st.length > 3) await st[3].click();
await wait(500);
await page.evaluate(() => window.__stickman.useStore.getState().setLeftTab("text"));
await wait(600);
await shot("4-text-tab");
console.log("blank after adds", await state());
await page.evaluate(() => window.__stickman.useStore.getState().setTime(1.5));
await wait(800);
await shot("5-blank-added");

// Play a moment.
await page.keyboard.press("Space");
await wait(1500);
await page.keyboard.press("Space");
await shot("6-after-play");

console.log("errors", errors.slice(0, 20));
await browser.close();
