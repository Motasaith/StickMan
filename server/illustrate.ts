// AI-drawn animated illustrations for topics the library doesn't cover. The model writes an
// SVG with SMIL animation in the library's flat style; the engine's own parser checks it.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chat, parseJsonObject } from "./llm";
import { parseSvg, svgProblem } from "../src/engine/svg";

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
    const svg = typeof obj?.svg === "string" ? obj.svg.trim() : "";
    const problem = !svg ? "no svg in the reply" : problemsWith(svg);
    if (!problem) return { name: typeof obj?.name === "string" ? obj.name.slice(0, 60) : topic.slice(0, 60), svg };
    lastProblem = problem;
    messages.push({ role: "assistant" as const, content: text.slice(0, 20000) } as never, { role: "user" as const, content: `That SVG has a problem: ${problem}. Return the complete corrected JSON.` } as never);
  }
  throw new Error(`The AI couldn't draw "${topic}" (${lastProblem}).`);
}

function problemsWith(svg: string): string | null {
  const basic = svgProblem(svg);
  if (basic) return basic;
  if (/<script|<foreignObject|javascript:|<image|@keyframes/i.test(svg)) return "it uses scripts, images or CSS animation, which are not allowed";
  const doc = parseSvg(svg)!;
  if (doc.viewBox[2] <= 0 || doc.viewBox[3] <= 0) return "the viewBox is missing";
  if (!/<animate/i.test(svg) && !/<set\b/i.test(svg)) return "it has no animation";
  const shapes = (svg.match(/<(path|rect|circle|ellipse|line|polyline|polygon)\b/g) ?? []).length;
  if (shapes < 14) return `it is too simple (${shapes} shapes); draw the details with at least 20 shapes`;
  return null;
}
