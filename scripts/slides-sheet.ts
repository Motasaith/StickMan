// Build a sample presentation with every slide layout and render frames into one sheet.
// Usage: npx tsx scripts/slides-sheet.ts <out.png> [theme]
import { GlobalFonts, createCanvas } from "@napi-rs/canvas";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { emptyScene, type Scene } from "../src/engine/scene";
import { addSlide, setTextMeasureContext, type SlideSpec } from "../src/engine/slides";
import { renderScene } from "../src/engine/render";
import { FONT_LIST } from "../src/engine/fonts";

export function registerNodeFonts() {
  for (const f of FONT_LIST) if (f.file) GlobalFonts.registerFromPath(join("public", "fonts", f.file), f.family);
  setTextMeasureContext(createCanvas(8, 8).getContext("2d") as unknown as CanvasRenderingContext2D);
}

export function nodeLookups() {
  const cache = new Map<string, string | undefined>();
  return {
    svgs: (src: string) => {
      if (cache.has(src)) return cache.get(src);
      let markup: string | undefined;
      try {
        if (src.startsWith("emoji:")) markup = readFileSync(join("public", "stickers", `${src.slice(6)}.svg`), "utf8");
        else if (src.startsWith("lib:")) markup = readFileSync(join("public", "illustrations", `${src.slice(4)}.svg`), "utf8");
      } catch {
        markup = undefined;
      }
      cache.set(src, markup);
      return markup;
    },
    makeCanvas: (w: number, h: number) => {
      const c = createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
      return { canvas: c as unknown as CanvasImageSource & { width: number; height: number }, ctx: c.getContext("2d") as unknown as CanvasRenderingContext2D };
    },
  };
}

const SAMPLE: SlideSpec[] = [
  { layout: "title", title: "Healthy Smiles", subtitle: "A guide to caring for your teeth", illustration: "teeth", narration: "Welcome! Today we will learn how to keep your smile healthy." },
  { layout: "bullets", title: "Daily habits", bullets: ["Brush twice a day for two minutes", "Floss once a day", "Drink water after meals"], illustration: "toothbrush", narration: "Three simple habits protect your teeth every single day." },
  { layout: "stat", title: "Did you know?", stat: { value: 92, label: "of adults have had a cavity", suffix: "%" }, illustration: "tooth", narration: "Most adults have had at least one cavity." },
  { layout: "chart", title: "Sugar in drinks", chart: { kind: "bar", data: [{ label: "Water", value: 0 }, { label: "Juice", value: 24 }, { label: "Soda", value: 39 }, { label: "Energy", value: 54 }], unit: "g" }, narration: "Sugary drinks feed the bacteria that cause decay." },
  { layout: "steps", title: "How to brush", steps: ["Wet the brush", "Small circles", "Every surface", "Rinse"], narration: "Follow these four steps each time you brush." },
  { layout: "comparison", title: "Good or bad for teeth", comparison: { leftTitle: "Good", left: ["Cheese", "Crunchy vegetables", "Water"], rightTitle: "Bad", right: ["Candy", "Soda", "Sticky snacks"] }, narration: "Some foods help your teeth and some harm them." },
  { layout: "quote", quote: { text: "Every tooth in a man's head is more valuable than a diamond.", author: "Miguel de Cervantes" } },
  { layout: "split", title: "Visit your dentist", body: "A check-up every six months catches problems early, before they hurt.", illustration: "stethoscope" },
  { layout: "closing", title: "Keep smiling!", subtitle: "Questions? Ask your dentist.", illustration: "happyface" },
];

if (process.argv[1]?.includes("slides-sheet")) {
  registerNodeFonts();
  const out = process.argv[2] ?? "slides.png";
  const theme = process.argv[3] ?? "medical";
  const scene: Scene = emptyScene();
  for (const spec of SAMPLE) addSlide(scene, spec, theme);
  const look = nodeLookups();
  const cw = 480;
  const ch = 270;
  const frames = scene.slides!.flatMap((s, i) => [s.start + s.duration * 0.75, ...(i > 0 ? [s.start + 0.35] : [])]);
  const cols = 4;
  const sheet = createCanvas(cols * cw, Math.ceil(frames.length / cols) * ch);
  const sctx = sheet.getContext("2d");
  const frame = createCanvas(scene.width, scene.height);
  const fctx = frame.getContext("2d") as unknown as CanvasRenderingContext2D;
  frames.forEach((t, i) => {
    renderScene(fctx, scene, t, look);
    sctx.drawImage(frame, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch);
    sctx.fillStyle = "rgba(0,0,0,0.6)";
    sctx.fillRect((i % cols) * cw, Math.floor(i / cols) * ch, 64, 18);
    sctx.fillStyle = "#fff";
    sctx.font = "12px sans-serif";
    sctx.fillText(`${t.toFixed(1)}s`, (i % cols) * cw + 6, Math.floor(i / cols) * ch + 13);
  });
  writeFileSync(out, sheet.toBuffer("image/png"));
  console.log(`${scene.slides!.length} slides, ${scene.duration}s, ${scene.objects.length} objects -> ${out}`);
}
