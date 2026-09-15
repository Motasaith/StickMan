// Illustrations the library doesn't have get drawn by the AI before the ops reach the editor:
// a presentation slide asking for "dental braces" gets a matching animated SVG, not a loose match.

import { coversTopic, findIllustration } from "../src/engine/illustrations";
import { drawIllustration, type Illustration } from "./illustrate";

const MAX_DRAWINGS = 4;

type AnyOp = Record<string, unknown> & { op?: string };
type SlideLike = { illustration?: string; title?: string };

/** A topic needs drawing when nothing in the library really covers it. */
function needsDrawing(ref: unknown): ref is string {
  if (typeof ref !== "string" || !ref.trim()) return false;
  if (ref.startsWith("emoji:") || ref.startsWith("asset:")) return false;
  const ill = findIllustration(ref.replace(/^lib:/, ""));
  return !ill || !coversTopic(ill, ref);
}

const slug = (topic: string) => topic.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 28) || "art";

export interface ArtCache {
  drawings: Map<string, Promise<Illustration | null>>;
}

export const newArtCache = (): ArtCache => ({ drawings: new Map() });

/**
 * Rewrites ops so missing illustrations point at freshly drawn SVGs. Topics that fail to draw
 * keep their original reference (the library's closest match, if any).
 */
export async function fillMissingArt(rawOps: unknown[], cache: ArtCache): Promise<{ ops: unknown[]; drawn: string[]; failed: string[] }> {
  const ops = rawOps.map((o) => (o && typeof o === "object" ? structuredClone(o) : o)) as AnyOp[];
  const topics = new Map<string, string>();
  const want = (topic: string, hint: string) => {
    const key = topic.trim().toLowerCase();
    if (!topics.has(key) && topics.size < MAX_DRAWINGS) topics.set(key, hint);
  };

  for (const op of ops) {
    if (!op || typeof op !== "object") continue;
    if (op.op === "presentation" && Array.isArray(op.slides)) {
      for (const sl of op.slides as SlideLike[]) if (needsDrawing(sl.illustration)) want(sl.illustration, `A slide titled "${sl.title ?? ""}" in a presentation called "${op.title ?? ""}"`);
    } else if (op.op === "slide" && needsDrawing(op.illustration)) {
      want(op.illustration, `A presentation slide titled "${op.title ?? ""}"`);
    } else if (op.op === "illustration" && needsDrawing(op.name)) {
      want(op.name, "");
    }
  }
  if (!topics.size) return { ops, drawn: [], failed: [] };

  for (const [topic, hint] of topics) {
    if (!cache.drawings.has(topic)) cache.drawings.set(topic, drawIllustration(topic, hint).catch(() => null));
  }
  const results = new Map<string, Illustration | null>();
  await Promise.all([...topics.keys()].map(async (t) => results.set(t, await cache.drawings.get(t)!)));

  const assetOps: AnyOp[] = [];
  const assetFor = new Map<string, string>();
  for (const [topic, ill] of results) {
    if (!ill) continue;
    const id = `art_${slug(topic)}`;
    assetFor.set(topic, id);
    assetOps.push({ op: "svgAsset", id, name: ill.name, svg: ill.svg });
  }
  const ref = (topic: unknown) => (typeof topic === "string" ? assetFor.get(topic.trim().toLowerCase()) : undefined);

  const out: AnyOp[] = [];
  for (const op of ops) {
    if (op?.op === "presentation" && Array.isArray(op.slides)) {
      for (const sl of op.slides as SlideLike[]) {
        const id = ref(sl.illustration);
        if (id) sl.illustration = `asset:${id}`;
      }
    } else if (op?.op === "slide") {
      const id = ref(op.illustration);
      if (id) op.illustration = `asset:${id}`;
    } else if (op?.op === "illustration") {
      const topic = String(op.name).trim().toLowerCase();
      const ill = results.get(topic);
      if (ill) {
        const w = (op.w ?? op.h ?? 320) as number;
        const h = (op.h ?? w) as number;
        const { colors: _colors, speed: _speed, ...rest } = op;
        out.push({ ...rest, op: "svg", name: ill.name, svg: ill.svg, w, h });
        continue;
      }
    }
    out.push(op);
  }
  const drawn = [...results].filter(([, v]) => v).map(([k]) => k);
  const failed = [...results].filter(([, v]) => !v).map(([k]) => k);
  // Assets only need to exist before the slides that use them.
  const needsAsset = out.some((o) => o?.op === "presentation" || o?.op === "slide");
  return { ops: needsAsset ? [...assetOps, ...out] : out, drawn, failed };
}
