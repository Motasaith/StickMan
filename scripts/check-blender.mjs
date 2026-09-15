// Build a 3D set from props with lighting presets and the auto director, then save frames.
// Usage: node scripts/check-blender.mjs <outDir> [chrome|firefox]
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { openEditor } from "./_editor.mjs";

const out = resolve(process.argv[2] ?? "check-blender");
const which = process.argv[3] ?? "chrome";
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch(
  which === "firefox"
    ? { browser: "firefox", executablePath: "C:/Program Files/Mozilla Firefox/firefox.exe", headless: true, defaultViewport: { width: 1600, height: 950 } }
    : { executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, defaultViewport: { width: 1600, height: 950 }, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }
);
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await openEditor(page, { kind: "3d" });

const results = await page.evaluate(() => {
  const { useStore } = window.__stickman;
  return useStore.getState().run([
    { op: "scene", mode: "3d", lighting: "golden", duration: 14 },
    { op: "prop", id: "road", kind: "road", x: 640, z: 180 },
    { op: "prop", id: "home", kind: "house", x: 300, z: -420, yaw: 15 },
    { op: "prop", id: "shop", kind: "shop", x: 900, z: -450, text: "BAKERY" },
    { op: "prop", id: "tree1", kind: "tree", x: 580, z: -520 },
    { op: "prop", id: "pine", kind: "pine", x: 1180, z: -300 },
    { op: "prop", id: "bush", kind: "bush", x: 120, z: -150 },
    { op: "prop", id: "lamp", kind: "streetlight", x: 760, z: -60 },
    { op: "prop", id: "bench", kind: "bench", x: 1020, z: -120 },
    { op: "prop", id: "car", kind: "car", x: 160, z: 420, yaw: 10, color: "#d64545" },
    { op: "prop", id: "fence", kind: "fence", x: 300, z: -250, w: 380 },
    { op: "character", id: "ali", name: "Ali", x: 250, z: 40, look: { hair: "spiky", shirt: "#2a9d8f" } },
    { op: "character", id: "zara", name: "Zara", x: 980, z: 20, facing: "left", look: { hair: "ponytail", shirt: "#ff70a6", dress: true } },
    { op: "creature", id: "rex", species: "dog", x: 180, z: 120 },
    { op: "walk", id: "ali", to: "zara", at: 0.5 },
    { op: "walk", id: "rex", x: 640, z: 120, at: 0.8 },
    { op: "say", character: "ali", text: "Hi Zara! Is the bakery open?", at: 6, duration: 2.5, voice: "none" },
    { op: "say", character: "zara", text: "Yes, fresh bread just came out!", at: 8.8, duration: 2.5, voice: "none" },
    { op: "direct" },
  ]).map((r) => (r.ok ? "" : r.message)).filter(Boolean);
});
console.log("op errors:", results.length ? results : "none");

async function frame(name, t, patch) {
  await page.evaluate(({ t, patch }) => {
    const { useStore } = window.__stickman;
    const s = useStore.getState();
    if (patch) s.run([{ op: "scene", ...patch }]);
    s.select(null);
    s.setTime(t);
  }, { t, patch });
  await new Promise((r) => setTimeout(r, 1200));
  const data = await page.$eval("main canvas", (c) => c.toDataURL("image/png"));
  writeFileSync(join(out, name), Buffer.from(data.split(",")[1], "base64"));
}
await frame("golden-0.5s.png", 0.5);
await frame("golden-4s.png", 4);
await frame("golden-7s.png", 7);
await frame("golden-9.5s.png", 9.5);
await frame("golden-13.5s.png", 13.5);
await frame("day-7s.png", 7, { lighting: "day" });
await frame("night-7s.png", 7, { lighting: "night" });
await frame("toon-day-4s.png", 4, { lighting: "day", look3d: "toon" });
await page.screenshot({ path: join(out, "ui.png") });

// An indoor set: a classroom with a lamp, writing on a 3D blackboard.
const room = await page.evaluate(() => {
  const { useStore } = window.__stickman;
  const s = useStore.getState();
  const next = structuredClone(s.scene);
  next.objects = [];
  next.camera3d = undefined;
  s.commit(next);
  return useStore.getState().run([
    { op: "scene", mode: "3d", lighting: "indoor", look3d: "soft", duration: 10 },
    { op: "prop", id: "wall", kind: "wall", x: 640, z: -520, w: 1600, h: 520, color: "#e8dcc8" },
    { op: "prop", id: "board", kind: "blackboard", x: 640, z: -470 },
    { op: "prop", id: "desk", kind: "desk", x: 420, z: 120 },
    { op: "prop", id: "chair", kind: "chair", x: 420, z: 220 },
    { op: "prop", id: "shelf", kind: "bookshelf", x: 1100, z: -420 },
    { op: "prop", id: "lamp", kind: "lamp", x: 180, z: -300, lit: true },
    { op: "prop", id: "plant", kind: "plant", x: 980, z: 60 },
    { op: "prop", id: "rug", kind: "rug", x: 640, z: 0 },
    { op: "character", id: "teacher", name: "Teacher", x: 900, z: -300, look: { hair: "bun", shirt: "#6a4c93", glasses: true } },
    { op: "write", id: "teacher", on: "board", text: "2 + 2 = 4", at: 0.5 },
    { op: "say", character: "teacher", text: "Easy, right?", at: 5, duration: 2, voice: "none" },
    { op: "direct" },
  ]).map((r) => (r.ok ? "" : r.message)).filter(Boolean);
});
console.log("room op errors:", room.length ? room : "none");
await frame("room-1s.png", 1);
await frame("room-4.5s.png", 4.5);
await frame("room-6s.png", 6);
await frame("room-night-toon-6s.png", 6, { lighting: "night", look3d: "toon" });
console.log("errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
