// Free media beyond Pexels, none of which needs a key: real photos from Wikimedia Commons
// and NASA, Creative Commons pictures and music from Openverse, and AI pictures from
// Pollinations (POLLINATIONS_API_KEY removes their watermark and the slow anonymous limit),
// or FLUX on Hugging Face when HF_TOKEN is set.

import { config } from "dotenv";
import { downloadStock, searchStock, type StockItem } from "./stock";

export type SourceId = "pexels" | "wikimedia" | "nasa" | "openverse";

export interface MediaItem extends StockItem {
  source: SourceId | "pollinations";
  license?: string;
}

const UA = "StickmanStudio/1.0 (local video editor; https://github.com/)";
const env = (name: string) => {
  if (!process.env[name]) config({ quiet: true });
  return process.env[name]?.trim() ?? "";
};

// Downloads are only allowed for files the server itself found, so the endpoint can't be
// pointed at arbitrary addresses.
const g = globalThis as unknown as { __stickmanFound?: Map<string, number> };
const found: Map<string, number> = (g.__stickmanFound ??= new Map());
function remember<T extends { src: string }>(items: T[]): T[] {
  const now = Date.now();
  for (const it of items) found.set(it.src, now);
  if (found.size > 5000) for (const [k, t] of found) if (now - t > 6 * 3_600_000) found.delete(k);
  return items;
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  // Some of these services drop the odd connection; a quick retry is enough.
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw Object.assign(new Error(`Search failed (${res.status})`), { status: res.status, retryAfter: Number(res.headers.get("retry-after")) || 0 });
      return (await res.json()) as Record<string, unknown>;
    } catch (err) {
      const { status, retryAfter } = err as { status?: number; retryAfter?: number };
      if (attempt >= 3 || (status && status < 500 && status !== 429)) throw err;
      await new Promise((r) => setTimeout(r, Math.min(8000, retryAfter ? retryAfter * 1000 : 700 * (attempt + 1))));
    }
  }
}

const strip = (html: string | undefined) => (html ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 80);

async function wikimedia(query: string, perPage: number): Promise<MediaItem[]> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  const params: Record<string, string> = {
    action: "query",
    generator: "search",
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: "6",
    gsrlimit: String(perPage),
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "1600",
    format: "json",
    origin: "*",
  };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const data = (await getJson(url.toString())) as {
    query?: { pages?: Record<string, { index: number; title: string; imageinfo?: Array<{ thumburl?: string; thumbwidth?: number; thumbheight?: number; url: string; width: number; height: number; descriptionurl: string; extmetadata?: Record<string, { value?: string }> }> }> };
  };
  return Object.values(data.query?.pages ?? {})
    .sort((a, b) => a.index - b.index)
    .flatMap((p) => {
      const info = p.imageinfo?.[0];
      if (!info || info.width < 640) return [];
      const meta = info.extmetadata ?? {};
      const license = strip(meta.LicenseShortName?.value) || "see file page";
      const artist = strip(meta.Artist?.value) || "Wikimedia Commons contributor";
      return [
        {
          id: `wikimedia-${p.title}`,
          source: "wikimedia" as const,
          kind: "image" as const,
          thumbnail: info.thumburl ?? info.url,
          src: info.thumburl ?? info.url,
          w: info.thumbwidth ?? info.width,
          h: info.thumbheight ?? info.height,
          credit: `${p.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, "")} by ${artist}, ${license}, via Wikimedia Commons`,
          license,
          page: info.descriptionurl,
        },
      ];
    });
}

async function nasa(query: string, perPage: number): Promise<MediaItem[]> {
  const data = (await getJson(`https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=${perPage}`)) as {
    collection?: { items?: Array<{ href: string; data?: Array<{ nasa_id: string; title?: string; center?: string }>; links?: Array<{ href: string }> }> };
  };
  return (data.collection?.items ?? []).flatMap((it) => {
    const d = it.data?.[0];
    const preview = it.links?.[0]?.href;
    if (!d || !preview) return [];
    // Previews ("~thumb", "~small", "~medium") have a larger sibling.
    const large = preview.replace(/~(thumb|small|medium)\.jpg$/, "~large.jpg");
    return [
      {
        id: `nasa-${d.nasa_id}`,
        source: "nasa" as const,
        kind: "image" as const,
        thumbnail: preview,
        src: large,
        w: 1600,
        h: 900,
        credit: `${(d.title ?? d.nasa_id).slice(0, 60)}, NASA${d.center ? ` ${d.center}` : ""}`,
        license: "NASA media (public domain in most cases)",
        page: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`,
      },
    ];
  });
}

/** Creative Commons pictures that allow commercial use and changes (YouTube monetisation). */
async function openverseImages(query: string, perPage: number): Promise<MediaItem[]> {
  const data = (await getJson(
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=${perPage}&license_type=commercial,modification&size=large&mature=false`
  )) as { results?: Array<{ id: string; title?: string; url: string; thumbnail?: string; width?: number; height?: number; creator?: string; license: string; license_version?: string; foreign_landing_url?: string; source?: string }> };
  return (data.results ?? []).map((r) => ({
    id: `openverse-${r.id}`,
    source: "openverse" as const,
    kind: "image" as const,
    thumbnail: r.thumbnail ?? r.url,
    src: r.url,
    w: r.width ?? 1280,
    h: r.height ?? 720,
    credit: `${(r.title ?? "Image").slice(0, 60)} by ${r.creator ?? "unknown"}, CC ${r.license.toUpperCase()} ${r.license_version ?? ""}`.trim(),
    license: `CC ${r.license.toUpperCase()}`,
    page: r.foreign_landing_url ?? "",
  }));
}

export interface MusicItem {
  id: string;
  title: string;
  src: string;
  duration: number;
  credit: string;
  license: string;
  page: string;
  genres: string[];
}

/** Creative Commons music and sound that allows commercial use. */
export async function searchMusic(query: string, opts: { minSeconds?: number; perPage?: number } = {}): Promise<MusicItem[]> {
  const data = (await getJson(
    `https://api.openverse.org/v1/audio/?q=${encodeURIComponent(query)}&page_size=${opts.perPage ?? 20}&license_type=commercial,modification&mature=false`
  )) as { results?: Array<{ id: string; title?: string; url: string; duration?: number | null; creator?: string; license: string; license_version?: string; foreign_landing_url?: string; genres?: string[] | null; filetype?: string | null }> };
  const min = (opts.minSeconds ?? 0) * 1000;
  const items = (data.results ?? [])
    .filter((r) => (r.duration ?? 0) >= min && /\.(mp3|ogg|wav|m4a|flac)(\?|$)/i.test(r.url))
    .map((r) => ({
      id: `openverse-audio-${r.id}`,
      title: (r.title ?? "Track").replace(/\.(mp3|wav|ogg|flac)$/i, "").slice(0, 80),
      src: r.url,
      duration: Math.round((r.duration ?? 0) / 100) / 10,
      credit: `"${(r.title ?? "Track").slice(0, 60)}" by ${r.creator ?? "unknown"}, CC ${r.license.toUpperCase()} ${r.license_version ?? ""}`.trim(),
      license: `CC ${r.license.toUpperCase()}`,
      page: r.foreign_landing_url ?? "",
      genres: r.genres ?? [],
    }));
  remember(items);
  return items;
}

export const SOURCES: Array<{ id: SourceId; label: string; kinds: Array<"image" | "video">; blurb: string }> = [
  { id: "pexels", label: "Pexels", kinds: ["video", "image"], blurb: "Stock video and photos" },
  { id: "wikimedia", label: "Wikimedia", kinds: ["image"], blurb: "Real photos: people, places, history" },
  { id: "nasa", label: "NASA", kinds: ["image"], blurb: "Space and science imagery" },
  { id: "openverse", label: "Openverse", kinds: ["image"], blurb: "Creative Commons pictures" },
];

export async function searchMedia(source: SourceId, query: string, kind: "image" | "video", orientation: "landscape" | "portrait" | "square", perPage = 18): Promise<MediaItem[]> {
  let items: MediaItem[];
  if (source === "pexels") items = (await searchStock(query, kind, orientation, perPage, 1280)).map((i) => ({ ...i, source: "pexels" as const }));
  else if (kind === "video") items = [];
  else if (source === "wikimedia") items = await wikimedia(query, perPage);
  else if (source === "nasa") items = await nasa(query, perPage);
  else items = await openverseImages(query, perPage);
  // Pictures that fit the frame's shape come first.
  if (kind === "image" && orientation !== "square") {
    const wantWide = orientation === "landscape";
    items.sort((a, b) => Number(wantWide ? b.w >= b.h : b.h >= b.w) - Number(wantWide ? a.w >= a.h : a.h >= a.w));
  }
  return remember(items);
}

/** Download a file a search returned. */
export async function downloadMedia(src: string, timeoutMs = 120_000): Promise<Buffer> {
  const url = new URL(src);
  if (/(^|\.)pexels\.com$/.test(url.hostname)) return downloadStock(src);
  if (!found.has(src)) throw new Error("That file didn't come from a search in this app.");
  if (url.protocol !== "https:") throw new Error("Only secure downloads are allowed.");
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > 150 * 1024 * 1024) throw new Error("That file is too large.");
  return bytes;
}

// ── AI pictures ─────────────────────────────────────────────────────

let lastAnonymous = 0;
let anonQueue: Promise<unknown> = Promise.resolve();

export const aiImagesKeyed = () => !!env("POLLINATIONS_API_KEY") || !!env("HF_TOKEN");

/** FLUX.1 [schnell] on Hugging Face's serverless inference (free monthly credits with a token). */
async function huggingFaceImage(prompt: string, w: number, h: number, seed: number, token: string): Promise<Buffer> {
  // The model works in 16px steps and around a megapixel.
  const scale = Math.min(1, Math.sqrt((1024 * 1024) / (w * h)));
  const snap = (n: number) => Math.max(256, Math.round((n * scale) / 16) * 16);
  const res = await fetch(`https://router.huggingface.co/hf-inference/models/${env("HF_IMAGE_MODEL") || "black-forest-labs/FLUX.1-schnell"}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "image/png" },
    body: JSON.stringify({ inputs: prompt, parameters: { width: snap(w), height: snap(h), seed, num_inference_steps: 4 } }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) throw new Error(`Hugging Face image failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * An AI picture for a prompt. With a key: gen.pollinations.ai, no watermark. Without: the public
 * endpoint, one request every few seconds, with a small watermark in the corner.
 */
export async function generateImage(prompt: string, w: number, h: number, seed: number): Promise<{ bytes: Buffer; credit: string; watermark: boolean }> {
  const key = env("POLLINATIONS_API_KEY");
  const clean = prompt.replace(/\s+/g, " ").trim().slice(0, 900);
  const hf = env("HF_TOKEN");
  if (hf) {
    try {
      return { bytes: await huggingFaceImage(clean, w, h, seed, hf), credit: "AI image (FLUX.1 schnell via Hugging Face)", watermark: false };
    } catch (err) {
      // Out of credits or the model is loading: fall back to Pollinations.
      console.warn(`[ai image] ${(err as Error).message}`);
    }
  }
  if (key) {
    const url = `https://gen.pollinations.ai/image/${encodeURIComponent(clean)}?model=flux&width=${w}&height=${h}&seed=${seed}&nologo=true`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`AI picture failed (${res.status})`);
    return { bytes: Buffer.from(await res.arrayBuffer()), credit: "AI image (Pollinations, FLUX)", watermark: false };
  }
  // Anonymous use is rate limited; space requests out and retry once when told to wait.
  const run = async () => {
    const wait = Math.max(0, lastAnonymous + 6000 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    for (let attempt = 0; attempt < 3; attempt++) {
      lastAnonymous = Date.now();
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(clean)}?width=${w}&height=${h}&seed=${seed}&model=flux`;
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(120_000) });
      if (res.ok && (res.headers.get("content-type") ?? "").startsWith("image/")) {
        return { bytes: Buffer.from(await res.arrayBuffer()), credit: "AI image (Pollinations, FLUX)", watermark: true };
      }
      await new Promise((r) => setTimeout(r, 12_000 * (attempt + 1)));
    }
    throw new Error("The free AI picture service is busy. Try again in a minute, or add POLLINATIONS_API_KEY to .env.");
  };
  const job = anonQueue.then(run, run);
  anonQueue = job.catch(() => {});
  return job;
}
