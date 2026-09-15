import { create } from "zustand";
import type { Asset, Project, Scene } from "./engine/scene";
import { emptyScene } from "./engine/scene";
import { applyOps, type OpResult } from "./engine/ops";
import { api } from "./lib/api";

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  text: string;
  changes?: OpResult[];
  pending?: boolean;
  error?: boolean;
  kind?: "plan" | "review";
}

export type SaveStatus = "saved" | "saving" | "pending" | "error";
export type LeftTab = "media" | "stock" | "text" | "stickers" | "illustrations" | "shapes" | "characters" | "props" | "effects" | "sounds" | "slides" | "record";

export interface Upload {
  id: string;
  name: string;
  progress: number;
  error?: string;
}

interface State {
  projectId: string | null;
  title: string;
  kind: string | undefined;
  saveStatus: SaveStatus;
  saveError: string | null;
  scene: Scene;
  assets: Asset[];
  selectedId: string | null;
  selectedKey: { id: string; t: number } | null;
  time: number;
  playing: boolean;
  loop: boolean;
  past: { scene: Scene; assets: Asset[] }[];
  future: { scene: Scene; assets: Asset[] }[];
  chat: ChatMsg[];
  aiBusy: boolean;
  review: boolean;
  voices: boolean;
  imagesVersion: number;
  mode: "ai" | "edit";
  leftTab: LeftTab;
  timelineZoom: number;
  snapping: boolean;
  uploads: Upload[];

  /** Replace the scene and record the previous one (or `base`) for undo. */
  commit: (next: Scene, base?: Scene) => void;
  /** Show a scene without recording history (drags, AI building up). */
  preview: (next: Scene) => void;
  /** Change the current scene in place as part of the last undo step (voices arriving). */
  amend: (update: (scene: Scene) => Scene) => void;
  setVoices: (v: boolean) => void;
  updateAsset: (id: string, patch: Partial<Asset>) => void;
  /** Apply ops as one undoable step. */
  run: (ops: unknown[]) => OpResult[];
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  selectKey: (k: { id: string; t: number } | null) => void;
  setTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setLoop: (l: boolean) => void;
  setReview: (r: boolean) => void;
  setAiBusy: (b: boolean) => void;
  addAsset: (a: Asset) => void;
  addAssets: (a: Asset[]) => void;
  removeAsset: (id: string) => void;
  bumpImages: () => void;
  loadProject: (p: Project & { id?: string; title?: string; kind?: string }) => void;
  newProject: (width: number, height: number) => void;
  setTitle: (t: string) => void;
  pushChat: (m: ChatMsg) => void;
  updateChat: (id: string, patch: Partial<ChatMsg>) => void;
  clearChat: () => void;
  setMode: (m: "ai" | "edit") => void;
  setLeftTab: (t: LeftTab) => void;
  setTimelineZoom: (z: number) => void;
  setSnapping: (s: boolean) => void;
  setUpload: (u: Upload) => void;
  removeUpload: (id: string) => void;
  setSaveStatus: (s: SaveStatus, error?: string | null) => void;
}

const HISTORY_LIMIT = 100;
const chatKey = (id: string | null) => `stickman-studio.chat.${id ?? "scratch"}`;

function loadChat(id: string | null): ChatMsg[] {
  try {
    const chat = JSON.parse(localStorage.getItem(chatKey(id)) ?? "[]") as ChatMsg[];
    return Array.isArray(chat) ? chat.filter((m) => !m.pending) : [];
  } catch {
    return [];
  }
}

export const useStore = create<State>((set, get) => ({
  projectId: null,
  title: "Untitled project",
  kind: undefined,
  saveStatus: "saved",
  saveError: null,
  scene: emptyScene(),
  assets: [],
  selectedId: null,
  selectedKey: null,
  time: 0,
  playing: false,
  loop: false,
  past: [],
  future: [],
  chat: [],
  aiBusy: false,
  review: true,
  voices: true,
  imagesVersion: 0,
  mode: "ai",
  leftTab: "media",
  timelineZoom: 1,
  snapping: true,
  uploads: [],

  commit: (next, base) =>
    set((s) => ({
      scene: next,
      past: [...s.past, { scene: base ?? s.scene, assets: s.assets }].slice(-HISTORY_LIMIT),
      future: [],
      selectedId: s.selectedId && next.objects.some((o) => o.id === s.selectedId) ? s.selectedId : null,
    })),
  preview: (next) => set({ scene: next }),
  amend: (update) => set((s) => ({ scene: update(s.scene) })),
  setVoices: (v) => set({ voices: v }),
  updateAsset: (id, patch) => set((s) => ({ assets: s.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
  run: (ops) => {
    const s = get();
    const out = applyOps(s.scene, ops, s.assets);
    if (out.newAssets.length) s.addAssets(out.newAssets);
    if (out.applied.length) s.commit(out.scene);
    return out.results;
  },
  undo: () =>
    set((s) => {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return { scene: prev.scene, assets: mergeAssets(prev.assets, s.assets), past: s.past.slice(0, -1), future: [{ scene: s.scene, assets: s.assets }, ...s.future], selectedKey: null };
    }),
  redo: () =>
    set((s) => {
      if (!s.future.length) return s;
      const [next, ...rest] = s.future;
      return { scene: next.scene, assets: mergeAssets(next.assets, s.assets), past: [...s.past, { scene: s.scene, assets: s.assets }], future: rest, selectedKey: null };
    }),
  select: (id) => set({ selectedId: id, selectedKey: null }),
  selectKey: (k) => set({ selectedKey: k, selectedId: k ? k.id : get().selectedId }),
  setTime: (t) => set((s) => ({ time: Math.max(0, Math.min(s.scene.duration, t)) })),
  setPlaying: (p) => set((s) => ({ playing: p, time: p && s.time >= s.scene.duration - 0.01 ? 0 : s.time })),
  setLoop: (l) => set({ loop: l }),
  setReview: (r) => set({ review: r }),
  setAiBusy: (b) => set({ aiBusy: b }),
  addAsset: (a) => set((s) => ({ assets: [...s.assets.filter((x) => x.id !== a.id), a] })),
  addAssets: (list) => set((s) => ({ assets: [...s.assets.filter((x) => !list.some((a) => a.id === x.id)), ...list] })),
  removeAsset: (id) => set((s) => ({ assets: s.assets.filter((a) => a.id !== id) })),
  bumpImages: () => set((s) => ({ imagesVersion: s.imagesVersion + 1 })),
  loadProject: (p) =>
    set({
      projectId: p.id ?? null,
      title: p.title ?? "Untitled project",
      kind: p.kind,
      scene: p.scene,
      assets: p.assets ?? [],
      past: [],
      future: [],
      selectedId: null,
      selectedKey: null,
      time: 0,
      playing: false,
      chat: loadChat(p.id ?? null),
      saveStatus: "saved",
      saveError: null,
    }),
  newProject: (width, height) =>
    set((s) => ({ scene: emptyScene(width, height), past: [...s.past, { scene: s.scene, assets: s.assets }], future: [], selectedId: null, selectedKey: null, time: 0, playing: false })),
  setTitle: (title) => set({ title: title.slice(0, 100) || "Untitled project" }),
  pushChat: (m) => set((s) => ({ chat: [...s.chat, m] })),
  updateChat: (id, patch) => set((s) => ({ chat: s.chat.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
  clearChat: () => set({ chat: [] }),
  setMode: (mode) => set({ mode }),
  setLeftTab: (leftTab) => set({ leftTab }),
  setTimelineZoom: (z) => set({ timelineZoom: Math.max(0.25, Math.min(12, z)) }),
  setSnapping: (snapping) => set({ snapping }),
  setUpload: (u) => set((s) => ({ uploads: [...s.uploads.filter((x) => x.id !== u.id), u] })),
  removeUpload: (id) => set((s) => ({ uploads: s.uploads.filter((x) => x.id !== id) })),
  setSaveStatus: (saveStatus, saveError = null) => set({ saveStatus, saveError }),
}));

/** Undo restores the scene; assets are only ever added, so newer ones (recordings) stay. */
function mergeAssets(older: Asset[], current: Asset[]): Asset[] {
  const ids = new Set(older.map((a) => a.id));
  return [...older, ...current.filter((a) => !ids.has(a.id))];
}

// Autosave: to the project on the server, a moment after changes settle.
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saving = false;
let again = false;

async function saveNow() {
  const s = useStore.getState();
  if (!s.projectId) return;
  if (saving) {
    again = true;
    return;
  }
  saving = true;
  useStore.getState().setSaveStatus("saving");
  try {
    await api.saveProject(s.projectId, { scene: s.scene, assets: s.assets, title: s.title, kind: s.kind });
    useStore.getState().setSaveStatus(again ? "pending" : "saved");
  } catch (err) {
    useStore.getState().setSaveStatus("error", (err as Error).message);
  } finally {
    saving = false;
    if (again) {
      again = false;
      schedule(400);
    }
  }
}

function schedule(ms: number) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveNow(), ms);
}

/** Save right away (leaving the editor, before export). */
export function flushSave(): Promise<void> {
  clearTimeout(saveTimer);
  return saveNow();
}

useStore.subscribe((s, prev) => {
  if (s.projectId && s.projectId === prev.projectId && (s.scene !== prev.scene || s.assets !== prev.assets || s.title !== prev.title)) {
    if (s.aiBusy && s.scene !== prev.scene && s.past === prev.past) return;
    if (s.saveStatus !== "saving") useStore.getState().setSaveStatus("pending");
    schedule(1200);
  }
  if (s.chat !== prev.chat && s.projectId === prev.projectId) {
    try {
      localStorage.setItem(chatKey(s.projectId), JSON.stringify(s.chat.filter((m) => !m.pending).slice(-60)));
    } catch {
      /* storage unavailable */
    }
  }
});

export const newId = () => Math.random().toString(36).slice(2, 10);
