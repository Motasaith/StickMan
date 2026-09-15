// Render a scene with every object type in the 3D view (real browser, WebGL) and save frames.
// Usage: node scripts/check-3d.mjs <outDir> [chrome|firefox]
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const out = resolve(process.argv[2] ?? "check-3d");
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
await page.goto("http://localhost:5178", { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load" });
await page.waitForFunction(() => window.__stickman, { timeout: 20000 });

const results = await page.evaluate(() => {
  const { useStore } = window.__stickman;
  const g = useStore.getState().scene.ground;
  return useStore.getState().run([
    { op: "scene", mode: "3d", background: "#bfe3ff", floor: "#cfe8b0", duration: 8 },
    { op: "draw", id: "board", name: "Blackboard", x: 760, y: 170, parts: [{ kind: "rect", x: 0, y: 0, w: 420, h: 240, fill: "#8b5a2b" }, { kind: "rect", x: 14, y: 14, w: 392, h: 212, fill: "#2f4f3a" }] },
    { op: "draw", id: "table", name: "Table", x: 420, y: g, z: 120, parts: [{ kind: "box3", x: -100, y: -104, w: 200, h: 14, d: 110, fill: "#b07a4a" }, { kind: "box3", x: -91, y: -90, w: 12, h: 90, d: 12, fill: "#7a4a1c" }, { kind: "box3", x: 79, y: -90, w: 12, h: 90, d: 12, fill: "#7a4a1c" }, { kind: "sphere3", cx: 40, cy: -120, r: 16, fill: "#ff595e" }, { kind: "cylinder3", cx: -40, y: -134, r: 12, h: 30, fill: "#ffd166" }] },
    { op: "draw", id: "tree", name: "Tree", x: 1130, y: g, z: -150, parts: [{ kind: "cylinder3", cx: 0, y: -150, r: 16, h: 150, fill: "#8d5524" }, { kind: "sphere3", cx: 0, cy: -210, r: 80, fill: "#4caf50" }] },
    { op: "draw", id: "grass", name: "Grass", x: 0, y: g, parts: [{ kind: "rect", x: 0, y: 0, w: 1280, h: 100, fill: "#8bc34a" }] },
    { op: "character", id: "ali", name: "Ali", x: 250, z: 60, look: { hair: "spiky", hat: "cap", shirt: "#2a9d8f" }, voice: "boy" },
    { op: "character", id: "zara", name: "Zara", x: 640, z: 0, facing: "left", look: { hair: "ponytail", shirt: "#ff70a6", dress: true, glasses: true } },
    { op: "character", id: "stick", x: 560, z: -120 },
    { op: "character", id: "bot", name: "Bot", x: 980, z: 80, facing: "left", look: { style: "robot", shirt: "#8ecae6" } },
    { op: "creature", id: "rex", species: "dog", x: 380, z: 260 },
    { op: "creature", id: "tom", species: "cat", x: 860, z: 220, facing: "left", pose: "sit" },
    { op: "creature", id: "tweety", species: "bird", x: 1130, y: g - 290, z: -150 },
    { op: "text", id: "title", text: "3D Stickman Studio", x: 640, y: 40, size: 56, align: "center", color: "#1a1a1a", bold: true },
    { op: "walk", id: "ali", x: 460, z: 250, at: 0.5 },
    { op: "action", id: "zara", action: "wave", at: 0.5, times: 3 },
    { op: "action", id: "bot", action: "dance", at: 0.5 },
    { op: "walk", id: "rex", x: 760, at: 0.5 },
    { op: "say", character: "zara", text: "Welcome to 3D!", at: 1, duration: 3, voice: "none" },
    { op: "effect", id: "fx", kind: "confetti", at: 0 },
    { op: "sound", kind: "pop", at: 1 },
  ]).map((r) => (r.ok ? "" : r.message)).filter(Boolean);
});
console.log("op errors:", results.length ? results : "none");

async function shot(name, t, camera) {
  await page.evaluate(({ t, camera }) => {
    const { useStore } = window.__stickman;
    const s = useStore.getState();
    if (camera) {
      const next = structuredClone(s.scene);
      next.camera3d = { tracks: Object.fromEntries(Object.entries(camera).map(([k, v]) => [k, [{ t: 0, v }]])) };
      s.preview(next);
    }
    s.select(null);
    s.setTime(t);
  }, { t, camera });
  await new Promise((r) => setTimeout(r, 900));
  const data = await page.$eval(".stage canvas", (c) => c.toDataURL("image/png"));
  writeFileSync(join(out, name), Buffer.from(data.split(",")[1], "base64"));
}
await shot("front-1.5s.png", 1.5);
await shot("orbit-2.5s.png", 2.5, { yaw: 38, pitch: 22 });
await shot("low-4s.png", 4, { yaw: -30, pitch: 6, dist: 1500 });
await page.screenshot({ path: join(out, "ui.png") });
console.log("errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
