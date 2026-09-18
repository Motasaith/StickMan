// Free stock photos and videos from Pexels (PEXELS_API_KEY in .env), as in PromptCut.

import { setting } from "./settings";

export interface StockItem {
  id: string;
  kind: "image" | "video";
  thumbnail: string;
  /** The file to download: the sharpest at or under full HD. */
  src: string;
  w: number;
  h: number;
  duration?: number;
  credit: string;
  page: string;
}

const BASE = "https://api.pexels.com";

export const stockConfigured = () => {
  return !!setting("PEXELS_API_KEY");
};

async function pexels(path: string) {
  const key = setting("PEXELS_API_KEY");
  if (!key) throw new Error("Stock media isn't set up: add your Pexels API key in Settings (free at pexels.com/api).");
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: key }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Pexels search failed (${res.status})`);
  return res.json() as Promise<Record<string, unknown>>;
}

/** Search Pexels. `maxDim` caps the longer side of the chosen file (smaller downloads for 720p edits). */
export async function searchStock(query: string, kind: "image" | "video", orientation: "landscape" | "portrait" | "square", perPage = 18, maxDim = 1920): Promise<StockItem[]> {
  const q = `query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=${orientation}`;
  if (kind === "image") {
    const data = (await pexels(`/v1/search?${q}`)) as { photos?: Array<{ id: number; url: string; photographer: string; width: number; height: number; src: Record<string, string> }> };
    return (data.photos ?? []).map((p) => ({
      id: `pexels-photo-${p.id}`,
      kind: "image",
      thumbnail: p.src.medium ?? p.src.small,
      src: p.src.large2x ?? p.src.large ?? p.src.original,
      w: p.width,
      h: p.height,
      credit: `Photo by ${p.photographer} on Pexels`,
      page: p.url,
    }));
  }
  const data = (await pexels(`/videos/search?${q}`)) as {
    videos?: Array<{ id: number; url: string; duration: number; width: number; height: number; image: string; user: { name: string }; video_files: Array<{ file_type: string; width: number; height: number; link: string }> }>;
  };
  return (data.videos ?? [])
    .map((v) => {
      const mp4s = v.video_files.filter((f) => f.file_type === "video/mp4").sort((a, b) => (b.width || 0) - (a.width || 0));
      const file = mp4s.find((f) => Math.max(f.width || 0, f.height || 0) <= maxDim) ?? mp4s[mp4s.length - 1];
      return {
        id: `pexels-video-${v.id}`,
        kind: "video" as const,
        thumbnail: v.image,
        src: file?.link ?? "",
        w: file?.width ?? v.width,
        h: file?.height ?? v.height,
        duration: v.duration,
        credit: `Video by ${v.user.name} on Pexels`,
        page: v.url,
      };
    })
    .filter((v) => v.src);
}

/** Download a stock file; only Pexels hosts are allowed. */
export async function downloadStock(src: string): Promise<Buffer> {
  const url = new URL(src);
  if (!/(^|\.)pexels\.com$/.test(url.hostname)) throw new Error("Only Pexels files can be imported this way.");
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
