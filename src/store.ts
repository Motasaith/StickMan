import { create } from "zustand";
import type { Asset, Project, Scene } from "./engine/scene";
import { emptyScene } from "./engine/scene";
import { applyOps, type OpResult } from "./engine/ops";

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  text: string;
  changes?: OpResult[];
  pending?: boolean;
  error?: boolean;
  kind?: "plan" | "review";
}

interface State {
  scene: Scene;
  assets: Asset[];
  selectedId: string | null;
  selectedKey: { id: string; t: number } | null;
  time: number;
  playing: boolean;
  loop: boolean;
  past: Scene[];
  future: Scene[];
  chat: ChatMsg[];
  aiBusy: boolean;
  review: boolean;
  voices: boolean;
  imagesVersion: number;

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
  removeAsset: (id: string) => void;
  bumpImages: () => void;
  loadProject: (p: Project) => void;
  newProject: (width: number, height: number) => void;
  pushChat: (m: ChatMsg) => void;
  updateChat: (id: string, patch: Partial<ChatMsg>) => void;
  clearChat: () => void;
}

const STORAGE_KEY = "stickman-studio.project";
const CHAT_KEY = "stickman-studio.chat";
const HISTORY_LIMIT = 100;

function loadSaved(): { project: Project | null; chat: ChatMsg[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const chat = JSON.parse(localStorage.getItem(CHAT_KEY) ?? "[]") as ChatMsg[];
    const project = raw ? (JSON.parse(raw) as Project) : null;
    if (project && project.scene?.version !== 1) return { project: null, chat: [] };
    return { project, chat: Array.isArray(chat) ? chat.filter((m) => !m.pending) : [] };
  } catch {
    return { project: null, chat: [] };
  }
}

const saved = loadSaved();

export const useStore = create<State>((set, get) => ({
  scene: saved.project?.scene ?? emptyScene(),
  assets: saved.project?.assets ?? [],
  selectedId: null,
  selectedKey: null,
  time: 0,
  playing: false,
  loop: false,
  past: [],
  future: [],
  chat: saved.chat,
  aiBusy: false,
  review: true,
  voices: true,
  imagesVersion: 0,

  commit: (next, base) =>
    set((s) => ({
      scene: next,
      past: [...s.past, base ?? s.scene].slice(-HISTORY_LIMIT),
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
    if (out.applied.length) s.commit(out.scene);
    return out.results;
  },
  undo: () =>
    set((s) => {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return { scene: prev, past: s.past.slice(0, -1), future: [s.scene, ...s.future], selectedKey: null };
    }),
  redo: () =>
    set((s) => {
      if (!s.future.length) return s;
      const [next, ...rest] = s.future;
      return { scene: next, past: [...s.past, s.scene], future: rest, selectedKey: null };
    }),
  select: (id) => set({ selectedId: id, selectedKey: null }),
  selectKey: (k) => set({ selectedKey: k, selectedId: k ? k.id : get().selectedId }),
  setTime: (t) => set((s) => ({ time: Math.max(0, Math.min(s.scene.duration, t)) })),
  setPlaying: (p) =>
    set((s) => ({ playing: p, time: p && s.time >= s.scene.duration - 0.01 ? 0 : s.time })),
  setLoop: (l) => set({ loop: l }),
  setReview: (r) => set({ review: r }),
  setAiBusy: (b) => set({ aiBusy: b }),
  addAsset: (a) => set((s) => ({ assets: [...s.assets, a] })),
  removeAsset: (id) => set((s) => ({ assets: s.assets.filter((a) => a.id !== id) })),
  bumpImages: () => set((s) => ({ imagesVersion: s.imagesVersion + 1 })),
  loadProject: (p) =>
    set({ scene: p.scene, assets: p.assets ?? [], past: [], future: [], selectedId: null, selectedKey: null, time: 0, playing: false }),
  newProject: (width, height) =>
    set((s) => ({ scene: emptyScene(width, height), past: [...s.past, s.scene], future: [], selectedId: null, selectedKey: null, time: 0, playing: false })),
  pushChat: (m) => set((s) => ({ chat: [...s.chat, m] })),
  updateChat: (id, patch) => set((s) => ({ chat: s.chat.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
  clearChat: () => set({ chat: [] }),
}));

// Autosave to this browser. Pictures can exceed the storage quota; the project file (Save) always has everything.
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useStore.subscribe((s, prev) => {
  if (s.scene === prev.scene && s.assets === prev.assets && s.chat === prev.chat) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ scene: s.scene, assets: s.assets }));
    } catch {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ scene: s.scene, assets: [] }));
      } catch {
        /* storage unavailable */
      }
    }
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(s.chat.slice(-60)));
    } catch {
      /* storage unavailable */
    }
  }, 600);
});

export const newId = () => Math.random().toString(36).slice(2, 10);
