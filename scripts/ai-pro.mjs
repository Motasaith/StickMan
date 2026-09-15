// End-to-end AI run from the home page: type a prompt, let the AI Director build it (voices,
// review), then screenshot frames and optionally export.
// Usage: node scripts/ai-pro.mjs <outDir> --kind presentation --prompt "..." [--no-review] [--export]
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const out = resolve(process.argv[2] ?? "ai-pro-out");
const kind = arg("--kind", "presentation");
const prompt = arg("--prompt", "A short talk for parents about keeping kids' teeth healthy, including braces.");
const review = !process.argv.includes("--no-review");
const doExport = process.argv.includes("--export");
mkdirSync(out, { recursive: true });

const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
const browser = await puppeteer.launch({ executablePath: exe, headless: true, defaultViewport: { width: 1600, height: 950 }, protocolTimeout: 1_800_000 });
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  errors.push(m.text());
  console.log("CONSOLE ERROR", m.text().slice(0, 2000));
});
page.on("pageerror", (e) => {
  errors.push(String(e));
  console.log("PAGE ERROR", String(e.stack ?? e).slice(0, 2000));
});
const cdp = await page.createCDPSession();
await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: out });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

await page.goto("http://localhost:5178", { waitUntil: "networkidle0" });
const kindLabel = { animation: "Animation", presentation: "Presentation", video: "Video edit", "3d": "3D film" }[kind];
await page.evaluate((label) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === label).click(), kindLabel);
await page.type("textarea", prompt);
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Make it")).click());
await page.waitForFunction(() => location.pathname.startsWith("/editor/"), { timeout: 20000 });
await page.waitForFunction(() => window.__stickman?.useStore.getState().aiBusy, { timeout: 20000 });
if (!review) await page.evaluate(() => window.__stickman.useStore.setState({ review: false }));
log("AI started");

let last = "";
while (true) {
  const s = await page.evaluate(() => {
    const st = window.__stickman.useStore.getState();
    return { busy: st.aiBusy, chat: st.chat.map((m) => `${m.role}: ${m.text}`).slice(-2).join(" | "), objects: st.scene.objects.length };
  });
  if (s.chat !== last) log(s.chat.slice(0, 300), `(${s.objects} objects)`);
  last = s.chat;
  if (!s.busy) break;
  await wait(3000);
  if (Date.now() - t0 > 25 * 60_000) throw new Error("timed out");
}

const info = await page.evaluate(() => {
  const st = window.__stickman.useStore.getState();
  const sc = st.scene;
  return {
    title: sc.title,
    theme: sc.theme,
    duration: sc.duration,
    slides: (sc.slides ?? []).map((s) => ({ id: s.id, title: s.title, start: s.start, duration: s.duration, layout: s.layout, illustration: s.spec?.illustration })),
    svgs: sc.objects.filter((o) => o.type === "svg").map((o) => `${o.id}=${o.src}`),
    audio: sc.objects.filter((o) => o.type === "audio").map((o) => `${o.id}:${o.asset ? "voiced" : "silent"}`),
    captions: sc.objects.filter((o) => o.type === "caption").map((o) => o.words.length),
    assets: st.assets.map((a) => `${a.id}:${a.kind}`),
    chat: st.chat.map((m) => `${m.role}: ${m.text}`),
  };
});
writeFileSync(join(out, "result.json"), JSON.stringify(info, null, 2));
console.log(JSON.stringify({ ...info, chat: undefined }, null, 1));
console.log(info.chat.join("\n"));

await page.evaluate(() => window.__stickman.useStore.getState().setPlaying(false));
const times = info.slides.length ? info.slides.map((s) => s.start + s.duration * 0.75) : [1, info.duration / 2, info.duration - 0.5];
for (let i = 0; i < times.length; i++) {
  await page.evaluate((t) => window.__stickman.useStore.getState().setTime(t), times[i]);
  await wait(900);
  const el = await page.$("main canvas");
  await (el ?? page).screenshot({ path: join(out, `frame-${i + 1}.png`) });
}
await page.screenshot({ path: join(out, "editor.png") });

if (doExport) {
  await page.evaluate(() => [...document.querySelectorAll("header button, button")].find((b) => b.textContent.trim() === "Export").click());
  await wait(800);
  await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent.trim() === "Export").click());
  log("exporting");
  await page.waitForFunction(() => [...document.querySelectorAll("[role=dialog]")].some((d) => d.textContent.includes("Saved ") || d.textContent.includes("failed")), { timeout: 20 * 60_000, polling: 2000 });
  log(await page.evaluate(() => document.querySelector("[role=dialog]").textContent.slice(0, 400)));
  await wait(2000);
  console.log("files", readdirSync(out));
}
console.log("errors", errors.slice(0, 20));
await browser.close();
