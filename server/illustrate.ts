// AI-drawn animated illustrations for topics the library doesn't cover. The model writes an
// SVG with SMIL animation in the library's flat style; the engine's own parser checks it.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chat, parseJsonObject } from "./llm";
import { cleanSvgMarkup, parseSvg, pathCommands, svgProblem } from "../src/engine/svg";

const RULES = `You draw flat, friendly animated illustrations as SVG code for presentation slides.

Return ONLY a JSON object: {"name": "short name", "svg": "<svg ...>...</svg>"}

The SVG must follow these rules exactly:
- <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"> and nothing outside the viewBox. Keep the subject centered, filling about 70% of the box, with a soft shadow ellipse under it (fill #2B2D42 opacity 0.08).
- Flat style: solid fills, no outlines except where a line IS the shape, rounded shapes, a little highlight on big shapes. Palette: blue #4F7CFF, purple #7B61FF, coral #FF6B6B, red #FF5A6E, yellow #FFC857, teal #2EC4B6, green #5BB85D, light green #7ED957, sky #7BB8FF, skin #F4C7A1, dark #2B2D42, light #EDF2FB, white #FFFFFF, brown #8D5A3B.
- Only these elements: g, path, rect, circle, ellipse, line, polyline, polygon, text, defs, linearGradient, radialGradient, stop, clipPath, use, animate, animateTransform, animateMotion, set.
- NO script, style tags, CSS animations, foreignObject, image, filters, masks, external links or fonts.
- Animate with SMIL so it loops gently and clearly shows the idea: something moves, grows, spins, blinks, bubbles or pulses. Use repeatCount="indefinite", durations 1.5s to 4s, and calcMode="spline" keySplines="0.45 0 0.55 1" for smooth easing (one keySplines entry per gap between values).
- animateTransform replaces the element's transform unless additive="sum", so animate a wrapper <g> instead of an element that already has a transform. For rotation give the center: values="0 200 200;360 200 200".
- Draw recognisable details (a dentist chair has a base, pump column, seat cushion, back rest, headrest, arm rests and an overhead lamp on a jointed arm; a factory has walls, windows, a saw-tooth roof, a chimney and smoke). Use at least 20 shapes and several shades of each color so it has depth.
- The subject stands on the ground: its lowest point is near y=330 and the shadow ellipse is at cy=356 under it. Nothing floats unless it flies.`;

/** Library illustrations as examples of the style, level of detail and animation. */
function examples(): string {
  return ["stethoscope", "laptop", "rocket"]
    .map((id) => {
      try {
        return `Example "${id}":\n${readFileSync(join(process.cwd(), "public", "illustrations", `${id}.svg`), "utf8")}`;
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

export interface Illustration {
  name: string;
  svg: string;
}

export async function drawIllustration(topic: string, hint = ""): Promise<Illustration> {
  const messages = [
    { role: "system" as const, content: `${RULES}\n\nMatch the style and detail of these library illustrations:\n\n${examples()}` },
    { role: "user" as const, content: `Draw: ${topic}${hint ? `\nContext: ${hint}` : ""}` },
  ];
  let lastProblem = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await chat(messages, { jsonMode: true, temperature: 0.5, reasoning: "high", timeoutMs: 240_000 });
    const obj = parseJsonObject(text);
    const svg = typeof obj?.svg === "string" ? cleanSvgMarkup(obj.svg) : "";
    const problem = !svg ? "no svg in the reply" : problemsWith(svg);
    if (!problem) return { name: typeof obj?.name === "string" ? obj.name.slice(0, 60) : topic.slice(0, 60), svg: fillTheBox(svg) };
    lastProblem = problem;
    messages.push({ role: "assistant" as const, content: text.slice(0, 20000) } as never, { role: "user" as const, content: `That SVG has a problem: ${problem}. Return the complete corrected JSON.` } as never);
  }
  throw new Error(`The AI couldn't draw "${topic}" (${lastProblem}).`);
}

function problemsWith(svg: string): string | null {
  const basic = svgProblem(svg);
  if (basic) return basic;
  if (/<script|<foreignObject|javascript:|<image|@keyframes/i.test(svg)) return "it uses scripts, images or CSS animation, which are not allowed";
  if (svg.includes("\\")) return "the markup is escaped (backslashes before quotes); return plain SVG";
  const doc = parseSvg(svg)!;
  if (doc.viewBox[2] <= 0 || doc.viewBox[3] <= 0) return "the viewBox is missing";
  if (!/<animate/i.test(svg) && !/<set\b/i.test(svg)) return "it has no animation";
  const shapes = (svg.match(/<(path|rect|circle|ellipse|line|polyline|polygon)\b/g) ?? []).length;
  if (shapes < 14) return `it is too simple (${shapes} shapes); draw the details with at least 20 shapes`;
  return null;
}
/** Rough bounding box of everything drawn, ignoring <defs> (gradient coordinates are not positions). */
function contentBounds(svg: string): { x: number; y: number; w: number; h: number } | null {
  const body = svg.replace(/<defs[\s\S]*?<\/defs>/gi, "");
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const point = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  const attr = (tag: string, name: string) => Number(tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([-\\d.eE+]+)["']`))?.[1] ?? NaN);
  for (const [, kind, tag] of body.matchAll(/<(rect|circle|ellipse|line|polyline|polygon|path)\b([^>]*)>/gi)) {
    const t = tag;
    switch (kind.toLowerCase()) {
      case "rect": {
        const x = attr(t, "x") || 0;
        const y = attr(t, "y") || 0;
        point(x, y);
        point(x + (attr(t, "width") || 0), y + (attr(t, "height") || 0));
        break;
      }
      case "circle": {
        const r = attr(t, "r") || 0;
        point((attr(t, "cx") || 0) - r, (attr(t, "cy") || 0) - r);
        point((attr(t, "cx") || 0) + r, (attr(t, "cy") || 0) + r);
        break;
      }
      case "ellipse": {
        const rx = attr(t, "rx") || 0;
        const ry = attr(t, "ry") || 0;
        point((attr(t, "cx") || 0) - rx, (attr(t, "cy") || 0) - ry);
        point((attr(t, "cx") || 0) + rx, (attr(t, "cy") || 0) + ry);
        break;
      }
      case "line":
        point(attr(t, "x1"), attr(t, "y1"));
        point(attr(t, "x2"), attr(t, "y2"));
        break;
      case "polyline":
      case "polygon": {
        const nums = (t.match(/points\s*=\s*["']([^"']*)["']/)?.[1] ?? "").split(/[\s,]+/).map(Number).filter(Number.isFinite);
        for (let i = 0; i + 1 < nums.length; i += 2) point(nums[i], nums[i + 1]);
        break;
      }
      case "path": {
        const d = t.match(/\bd\s*=\s*["']([^"']*)["']/)?.[1] ?? "";
        for (const cmd of pathCommands(d)) for (let i = 0; i + 1 < cmd.p.length; i += 2) point(cmd.p[i], cmd.p[i + 1]);
        break;
      }
    }
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * A drawing that sits small inside its viewBox looks lost on a slide, so scale it up to fill
 * the box. Wrapping in an outer group keeps every animation inside working.
 */
export function fillTheBox(svg: string): string {
  const doc = parseSvg(svg);
  const box = contentBounds(svg);
  if (!doc || !box) return svg;
  const [vx, vy, vw, vh] = doc.viewBox;
  if (vw <= 0 || vh <= 0) return svg;
  const scale = Math.min((vw * 0.82) / box.w, (vh * 0.82) / box.h);
  if (scale < 1.2 || scale > 4) return svg;
  const tx = vx + vw / 2 - (box.x + box.w / 2) * scale;
  const ty = vy + vh / 2 - (box.y + box.h / 2) * scale;
  const open = svg.match(/<svg\b[^>]*>/i)?.[0];
  const end = svg.lastIndexOf("</svg>");
  if (!open || end < 0) return svg;
  const inner = svg.slice(svg.indexOf(open) + open.length, end);
  const r = (n: number) => Math.round(n * 100) / 100;
  return `${open}<g transform="translate(${r(tx)} ${r(ty)}) scale(${r(scale)})">${inner}</g></svg>`;
}
