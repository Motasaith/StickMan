// Talking to this app's server: projects, media, voices, stock, speech-to-text, AI drawings, exports.

import type { Asset, Word } from "@/engine/scene";

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({ error: `Server error ${res.status}` }))) as T & { error?: string };
  if (!res.ok || data.error) throw new Error(data.error ?? `Server error ${res.status}`);
  return data;
}

const post = (url: string, body: unknown, method = "POST") => fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export interface ProjectSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  thumbnail: string | null;
  kind?: string;
  duration?: number;
  format?: string;
}

export interface ProjectData {
  id: string;
  title: string;
  scene: unknown;
  assets: Asset[];
  thumbnail: string | null;
  kind?: string;
  updatedAt: number;
}

export const api = {
  listProjects: () => fetch("/api/projects").then((r) => json<{ projects: ProjectSummary[] }>(r)).then((d) => d.projects),
  createProject: (body: { title?: string; scene: unknown; assets?: Asset[]; kind?: string }) => post("/api/projects", body).then((r) => json<{ id: string }>(r)),
  getProject: (id: string) => fetch(`/api/projects/${id}`).then((r) => json<ProjectData>(r)),
  saveProject: (id: string, body: { title?: string; scene?: unknown; assets?: Asset[]; thumbnail?: string | null; kind?: string }) => post(`/api/projects/${id}`, body, "PUT").then((r) => json<{ updatedAt: number }>(r)),
  deleteProject: (id: string) => fetch(`/api/projects/${id}`, { method: "DELETE" }).then((r) => json<{ ok: boolean }>(r)),
  duplicateProject: (id: string) => post(`/api/projects/${id}/duplicate`, {}).then((r) => json<{ id: string }>(r)),
  listVersions: (id: string) => fetch(`/api/projects/${id}/versions`).then((r) => json<{ versions: { id: string; at: number; label: string | null; auto: boolean }[] }>(r)).then((d) => d.versions),
  addVersion: (id: string, label: string) => post(`/api/projects/${id}/versions`, { label }).then((r) => json<{ id: string }>(r)),
  getVersion: (id: string, vid: string) => fetch(`/api/projects/${id}/versions/${vid}`).then((r) => json<{ scene: unknown; assets: Asset[]; title: string }>(r)),

  /** Upload a file to the media library, reporting progress (0..1). */
  upload: (file: File | Blob, name: string, origin = "upload", onProgress?: (f: number) => void) =>
    new Promise<MediaUpload>((resolve, reject) => {
      const form = new FormData();
      form.append("file", file, name);
      form.append("origin", origin);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/media");
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText) as MediaUpload & { error?: string };
          if (xhr.status >= 400 || data.error) reject(new Error(data.error ?? `Upload failed (${xhr.status})`));
          else resolve(data);
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed: the server didn't answer"));
      xhr.send(form);
    }),

  voice: (text: string, voice: string) => post("/api/voice", { text, voice }).then((r) => json<{ id: string; src: string; duration: number; words: Word[]; waveform: number[] }>(r)),
  stockSearch: (q: string, kind: "image" | "video", orientation: string) =>
    fetch(`/api/stock/search?q=${encodeURIComponent(q)}&kind=${kind}&orientation=${orientation}`).then((r) => json<{ items: StockItem[]; configured: boolean }>(r)),
  stockImport: (item: StockItem, name: string) => post("/api/stock/import", { src: item.src, name, credit: item.credit }).then((r) => json<MediaUpload>(r)),
  transcribe: (media: string, language: string, from?: number, to?: number | null) => post("/api/transcribe", { media, language, from, to }).then((r) => json<{ words: Word[] }>(r)),
  illustrate: (topic: string, hint?: string) => post("/api/ai/illustrate", { topic, hint }).then((r) => json<{ name: string; svg: string }>(r)),
  convert: async (video: Blob, opts: Record<string, string | number | undefined>) => {
    const q = Object.entries(opts)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join("&");
    const res = await fetch(`/api/export/convert?${q}`, { method: "POST", body: video, headers: { "Content-Type": "application/octet-stream" } });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Export failed (${res.status})`);
    return { blob: await res.blob(), ext: res.headers.get("X-File-Ext") ?? "bin" };
  },
};

export interface MediaUpload {
  id: string;
  file: string;
  src: string;
  name: string;
  kind: "image" | "video" | "audio" | "svg";
  w: number;
  h: number;
  duration?: number;
  hasAudio?: boolean;
  filmstrip?: string;
  frames?: number;
  waveform?: number[];
  origin?: string;
  credit?: string;
}

export interface StockItem {
  id: string;
  kind: "image" | "video";
  thumbnail: string;
  src: string;
  w: number;
  h: number;
  duration?: number;
  credit: string;
  page: string;
}

/** An editor asset from an uploaded media file. */
export function assetFromUpload(m: MediaUpload, displayName?: string): Asset {
  return {
    id: m.id,
    name: (displayName ?? m.name).replace(/\.[a-z0-9]+$/i, "").slice(0, 40) || m.kind,
    src: m.src,
    w: m.w,
    h: m.h,
    kind: m.kind,
    duration: m.duration,
    hasAudio: m.hasAudio,
    origin: m.origin,
    credit: m.credit,
    filmstrip: m.filmstrip,
    frames: m.frames,
    waveform: m.waveform,
  } as Asset;
}
