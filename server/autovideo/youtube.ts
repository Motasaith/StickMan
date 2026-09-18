// How crowded a topic already is on YouTube, from real search results. Needs YOUTUBE_API_KEY
// (YouTube Data API v3, free quota); without it the angles only carry the AI's own judgment.

import { setting } from "../settings";

export interface Competition {
  level: "low" | "medium" | "high";
  /** Among the top results, videos with over 100k views. */
  bigVideos: number;
  /** Median views of the top results. */
  medianViews: number;
  top: Array<{ title: string; channel: string; views: number; published: string }>;
}

const key = () => setting("YOUTUBE_API_KEY");

export const youtubeConfigured = () => !!key();

const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

async function yt(path: string, params: Record<string, string>) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key());
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`YouTube search failed (${res.status})`);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function checkCompetition(phrase: string): Promise<Competition | null> {
  if (!key() || !phrase.trim()) return null;
  const search = (await yt("search", { part: "snippet", q: phrase, type: "video", maxResults: "12", order: "relevance" })) as {
    items?: Array<{ id: { videoId: string }; snippet: { title: string; channelTitle: string; publishedAt: string } }>;
  };
  const items = search.items ?? [];
  if (!items.length) return { level: "low", bigVideos: 0, medianViews: 0, top: [] };
  const stats = (await yt("videos", { part: "statistics", id: items.map((i) => i.id.videoId).join(",") })) as {
    items?: Array<{ id: string; statistics: { viewCount?: string } }>;
  };
  const views = new Map((stats.items ?? []).map((s) => [s.id, Number(s.statistics.viewCount ?? 0)]));
  const rows = items.map((i) => ({ title: decode(i.snippet.title), channel: decode(i.snippet.channelTitle), views: views.get(i.id.videoId) ?? 0, published: i.snippet.publishedAt.slice(0, 10) }));
  const sorted = rows.map((r) => r.views).sort((a, b) => a - b);
  const medianViews = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const bigVideos = rows.filter((r) => r.views > 100_000).length;
  const huge = rows.filter((r) => r.views > 1_000_000).length;
  const level = huge >= 3 || bigVideos >= 7 ? "high" : bigVideos >= 3 ? "medium" : "low";
  return { level, bigVideos, medianViews, top: [...rows].sort((a, b) => b.views - a.views).slice(0, 3) };
}
