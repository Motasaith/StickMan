// Browser check for the creator-led flows and the publishing kit: the home page demo, the
// "My voice" wizard (a narration file becomes the script, visuals and edit), then the editor's
// YouTube kit (thumbnail, subtitles, chapters, Short) and the stock sources.
// Usage: node scripts/kit-ui.mjs <outDir> [--visuals stock|ai|real|mix] [--skip-build <projectId>]
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const out = resolve(process.argv[2] ?? "kit-ui-out");
const visuals = arg("--visuals", "stock");
const existing = arg("--skip-build", "");
mkdirSync(out, { recursive: true });
const BASE = "http://localhost:5178";

const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
const browser = await puppeteer.launch({ executablePath: exe, headless: true, defaultViewport: { width: 1440, height: 1000 }, protocolTimeout: 3_600_000, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));
page.on("pageerror", (e) => errors.push(`PAGE ${String(e).slice(0, 300)}`));
const cdp = await page.createCDPSession();
await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: out });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
const shot = (name, full = false) => page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
const click = (text, scope = "button") =>
  page.evaluate(
    (text, scope) => {
      const el = [...document.querySelectorAll(scope)].find((b) => b.textContent.replace(/\s+/g, " ").trim().includes(text) && !b.disabled);
      if (!el) throw new Error(`no enabled ${scope} with "${text}"`);
      el.scrollIntoView({ block: "center" });
      el.click();
    },
    text,
    scope
  );
const waitText = (text, timeout = 300_000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout, polling: 500 }, text);

// 1. Home demo.
await page.goto(BASE, { waitUntil: "networkidle0" });
await page.evaluate(() => document.querySelector("#demo").scrollIntoView());
await wait(1500);
await shot("1-demo");
const before = await page.evaluate(() => document.querySelector("#demo").innerText.match(/\d+:\d\d \/ (\d+:\d\d)/)?.[1]);
await click("Add a neon intro");
await wait(800);
await click("Glitch transitions");
await wait(800);
await click("Wave hello here");
await wait(2500);
await shot("1b-demo-edited");
const after = await page.evaluate(() => ({ len: document.querySelector("#demo").innerText.match(/\d+:\d\d \/ (\d+:\d\d)/)?.[1], chat: [...document.querySelectorAll("#demo p")].map((p) => p.textContent).filter((t) => t.startsWith("Done") || t.startsWith("Nothing") || t.includes("Skipped")) }));
log("demo", before, "->", after);
await click("Undo");
await wait(500);

let projectId = existing;
if (!projectId) {
  // 2. A narration file, made with an online voice, stands in for the creator's recording.
  const text =
    "Every January, millions of people promise to save more money. By March, most of them have quit. The problem is not willpower. It is the way the plan was built. " +
    "Here is a better way. First, pay yourself before you pay anything else, even if it is only ten dollars. Second, make saving automatic, so you never have to decide again. " +
    "Third, give every dollar a job. Money without a purpose disappears. Try this for one month, and watch what happens to your balance.";
  const mp3 = await page.evaluate(async (text) => {
    const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice: "man" }) });
    return (await r.json()).audio;
  }, text);
  if (!mp3) throw new Error("no TTS audio");
  const file = join(out, "my-narration.mp3");
  writeFileSync(file, Buffer.from(mp3.split(",")[1], "base64"));
  log("narration file ready");

  await page.goto(`${BASE}/create`, { waitUntil: "networkidle0" });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: "networkidle0" });
  await click("My voice");
  await click("Personal Finance");
  await wait(500);
  await shot("2-my-voice", true);
  const input = await page.$("input[type=file]");
  if (!input) throw new Error("no recording upload");
  await input.uploadFile(file);
  await waitText("words", 180_000);
  await page.waitForFunction(() => /Plan the scenes/.test(document.body.innerText) && [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Plan the scenes") && !b.disabled), { timeout: 180_000, polling: 1000 });
  log("recording transcribed");
  await shot("2b-recorded", true);
  await click("Plan the scenes");
  await waitText("SCENE 1", 240_000);
  log("scenes planned");
  await shot("3-scenes", true);
  const scenes = await page.evaluate(() => [...document.querySelectorAll("textarea")].map((t) => t.value));
  console.log("scene texts", scenes);
  await click("Add your recording");
  await waitText("Narrate it yourself", 20_000);
  await wait(1500);
  await page.evaluate((visuals) => {
    const s = JSON.parse(sessionStorage.getItem("stickman-create"));
    s.help.visuals = visuals;
    sessionStorage.setItem("stickman-create", JSON.stringify(s));
  }, visuals);
  await page.reload({ waitUntil: "networkidle0" });
  await wait(2000);
  await shot("4-voice", true);
  await click("Build the video");
  log("building");
  let last = "";
  for (;;) {
    await wait(3000);
    const state = await page.evaluate(() => ({ path: location.pathname, text: document.querySelector("ol.space-y-3")?.innerText.replace(/\s+/g, " ").slice(0, 300) ?? "" }));
    if (state.path.startsWith("/editor/")) break;
    if (state.text !== last) log(state.text);
    last = state.text;
    const ended = await page.evaluate(() => document.body.innerText.includes("Back to the voice") || document.body.innerText.includes("Open in the editor"));
    if (ended) {
      await shot("5-build-end", true);
      if (!(await page.evaluate(() => document.body.innerText.includes("Open in the editor")))) throw new Error("build failed");
      await click("Open in the editor");
    }
    if (Date.now() - t0 > 40 * 60_000) throw new Error("timed out");
  }
  projectId = await page.evaluate(() => location.pathname.split("/").pop());
} else {
  await page.goto(`${BASE}/editor/${projectId}`, { waitUntil: "load" });
}
log("editor", projectId);
await page.waitForFunction(() => window.__stickman?.useStore.getState().projectId, { timeout: 30_000 });
await wait(4000);
const info = await page.evaluate(() => {
  const s = window.__stickman.useStore.getState();
  return {
    duration: s.scene.duration,
    slides: s.scene.slides?.map((x) => `${x.id}:${x.start.toFixed(1)}+${x.duration.toFixed(1)}`),
    voices: s.scene.objects.filter((o) => o.type === "audio" && o.role === "narration").map((o) => `${o.start.toFixed(1)} in=${o.in.toFixed(1)} d=${o.duration.toFixed(1)}`),
    shots: s.scene.objects.filter((o) => o.type === "video" || o.type === "image").length,
    music: s.scene.objects.filter((o) => o.type === "audio" && o.role === "music").length,
    markers: s.scene.markers?.length,
  };
});
console.log(info);
for (const t of [2, info.duration * 0.4, info.duration * 0.75]) {
  await page.evaluate((t) => window.__stickman.useStore.getState().setTime(t), t);
  await wait(2500);
  await (await page.$("main canvas")).screenshot({ path: join(out, `frame-${Math.round(t)}.png`) });
}

// 3. YouTube kit.
await page.evaluate(() => window.__stickman.useStore.getState().select(null));
await click("Edit");
await wait(500);
await shot("6-project-panel");
const kit = await page.evaluate(() => [...document.querySelectorAll("aside, div")].filter((d) => d.textContent.includes("YouTube kit")).at(-1)?.innerText.slice(0, 400));
console.log("kit:", kit);
await click("Subtitles .srt");
await wait(1500);
await click("Thumbnail");
await page.waitForFunction(() => document.querySelector("[role=dialog]")?.querySelectorAll("canvas").length >= 6, { timeout: 60_000 });
await wait(4000);
await shot("7-thumbnails");
await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].filter((b) => b.textContent.trim() === "JPG")[0].click());
await wait(2000);
await page.keyboard.press("Escape");
await wait(500);
await click("Make a Short");
await waitText("Short made", 60_000);
log("short made");
await click("Open it");
await page.waitForFunction((id) => !location.pathname.endsWith(id) && window.__stickman?.useStore.getState().projectId !== id, { timeout: 30_000 }, projectId);
await wait(5000);
const short = await page.evaluate(() => {
  const s = window.__stickman.useStore.getState();
  return { w: s.scene.width, h: s.scene.height, duration: s.scene.duration, slides: s.scene.slides?.length, title: s.title };
});
console.log("short", short);
await page.evaluate((t) => window.__stickman.useStore.getState().setTime(t), 4);
await wait(2500);
await shot("8-short");

// 4. Stock sources.
await page.evaluate(() => window.__stickman.useStore.getState().setLeftTab("stock"));
await wait(800);
await click("NASA");
await page.type("input[placeholder^='Search']", "saturn");
await page.keyboard.press("Enter");
await wait(6000);
await shot("9-stock-nasa");
console.log("files", readdirSync(out).filter((f) => !f.endsWith(".png")));
console.log("errors", errors.slice(0, 15));
await browser.close();
