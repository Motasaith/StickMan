// Walk the AI video maker in a real browser: home page idea, niche, angle, script, voice,
// build, then the editor (and optionally export). Screenshots each step.
// Usage: node scripts/create-ui.mjs <outDir> [--niche finance] [--length short] [--idea "..."] [--voice woman] [--export]
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const out = resolve(process.argv[2] ?? "create-ui-out");
const niche = arg("--niche", "finance");
const length = arg("--length", "short");
const idea = arg("--idea", "why most people never get rich from their salary");
const voice = arg("--voice", "");
const doExport = process.argv.includes("--export");
mkdirSync(out, { recursive: true });

const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
const browser = await puppeteer.launch({ executablePath: exe, headless: true, defaultViewport: { width: 1440, height: 1000 }, protocolTimeout: 3_600_000 });
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 400));
});
page.on("pageerror", (e) => errors.push(`PAGE ${String(e).slice(0, 400)}`));
const cdp = await page.createCDPSession();
await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: out });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
const shot = (name, full = true) => page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
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
const waitText = (text, timeout = 300_000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout, polling: 500 }, text);

await page.goto("http://localhost:5178", { waitUntil: "networkidle0" });
await page.evaluate(() => sessionStorage.clear());
await shot("1-home", false);
await click("AI video");
await page.type("textarea", idea);
await click("Make it");
await page.waitForFunction(() => location.pathname === "/create", { timeout: 10_000 });
await waitText("Pick your channel", 60_000);
log("wizard open");

const nicheLabel = { finance: "Personal Finance", documentary: "Mini-Documentaries", shorts: "Did-You-Know", tech: "Tech & AI" }[niche] ?? niche;
await click(nicheLabel);
const lengthLabel = { short: "Short (under 60s", 3: "About 3 minutes", 5: "About 5 minutes" }[length];
await click(lengthLabel);
await wait(300);
await shot("2-idea");
await click("Find fresh angles");
await waitText("Pick an angle nobody", 240_000);
log("angles ready");
await shot("3-angles");
await page.evaluate(() => {
  const card = [...document.querySelectorAll("button")].find((b) => b.querySelector("p.font-display"));
  card.click();
});
await click("Write the script");
await waitText("Check before you publish", 480_000).catch(() => waitText("Choose the voice", 10_000));
log("script ready");
await shot("4-script");
await click("Choose the voice");
await waitText("Choose a voice", 20_000);
await wait(1500);
if (voice) {
  await page.evaluate((voice) => {
    const s = JSON.parse(sessionStorage.getItem("stickman-create"));
    s.voice = voice;
    sessionStorage.setItem("stickman-create", JSON.stringify(s));
  }, voice);
  await page.reload({ waitUntil: "networkidle0" });
  await wait(1500);
}
await shot("5-voice");
await click("Build the video");
log("building");
let last = "";
for (;;) {
  await wait(3000);
  const state = await page.evaluate(() => ({ path: location.pathname, text: document.querySelector("ol.space-y-3")?.innerText.replace(/\s+/g, " ").slice(0, 300) ?? "" }));
  if (state.path.startsWith("/editor/")) break;
  if (state.text !== last) log(state.text);
  last = state.text;
  const failed = await page.evaluate(() => document.body.innerText.includes("Back to the voice") || document.body.innerText.includes("Open in the editor"));
  if (failed) {
    await shot("6-build-end");
    const canOpen = await page.evaluate(() => document.body.innerText.includes("Open in the editor"));
    if (!canOpen) throw new Error("build failed");
    await click("Open in the editor");
  }
  if (Date.now() - t0 > 60 * 60_000) throw new Error("timed out");
}
log("editor open");
await page.waitForSelector("main canvas", { timeout: 30_000 });
await wait(4000);
const info = await page.evaluate(() => {
  const s = window.__stickman.useStore.getState();
  return { title: s.title, duration: s.scene.duration, slides: s.scene.slides?.length, videos: s.scene.objects.filter((o) => o.type === "video").length, images: s.scene.objects.filter((o) => o.type === "image").length, voiced: s.scene.objects.filter((o) => o.type === "audio" && o.asset).length, publish: !!s.scene.publish };
});
console.log(info);
for (const t of [1.5, info.duration * 0.33, info.duration * 0.66, info.duration - 1]) {
  await page.evaluate((t) => window.__stickman.useStore.getState().setTime(t), t);
  await wait(2500);
  await (await page.$("main canvas")).screenshot({ path: join(out, `frame-${Math.round(t)}.png`) });
}
await shot("7-editor", false);

if (doExport) {
  await click("Export");
  await wait(800);
  await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent.trim() === "Export").click());
  log("exporting");
  await page.waitForFunction(() => [...document.querySelectorAll("[role=dialog]")].some((d) => d.textContent.includes("Saved ") || d.textContent.includes("failed")), { timeout: 60 * 60_000, polling: 2000 });
  log(await page.evaluate(() => document.querySelector("[role=dialog]").innerText.slice(-200)));
  await wait(2000);
  console.log("files", readdirSync(out).filter((f) => !f.endsWith(".png")));
}
console.log("errors", errors.slice(0, 15));
await browser.close();
