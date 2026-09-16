// The voice list, loaded once and shared, plus one preview player for the whole app.

import { useEffect, useState, useSyncExternalStore } from "react";
import { api, type BlendPart, type VoiceList } from "./api";

let list: VoiceList | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function refreshVoices(): Promise<void> {
  loading = api
    .voices()
    .then((v) => {
      list = v;
      emit();
    })
    .catch(() => {})
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** The voices on this computer and online; null while loading. */
export function useVoices(): VoiceList | null {
  const v = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => list
  );
  useEffect(() => {
    if (!list && !loading) void refreshVoices();
  }, []);
  return v;
}

export interface VoiceOption {
  id: string;
  label: string;
  group: "Online (fast)" | "Studio (on this computer)" | "Blends" | "Your voices";
  note?: string;
  engine: "edge" | "kokoro" | "clone";
}

/** Every voice as one flat list, for pickers. */
export function voiceOptions(v: VoiceList | null): VoiceOption[] {
  if (!v) return [];
  return [
    ...v.edge.map((e) => ({ id: e.id, label: e.label, group: "Online (fast)" as const, engine: "edge" as const })),
    ...v.studio.map((s) => ({ id: s.id, label: `${s.name} (${s.language}, ${s.gender})`, group: "Studio (on this computer)" as const, note: s.note, engine: "kokoro" as const })),
    ...v.presets.map((p) => ({ id: p.id, label: p.name, group: "Blends" as const, note: p.desc, engine: "kokoro" as const })),
    ...v.saved.map((s) => ({ id: s.id, label: `${s.name}${s.kind === "clone" ? " (clone)" : " (blend)"}`, group: "Your voices" as const, note: s.note, engine: s.kind === "clone" ? ("clone" as const) : ("kokoro" as const) })),
  ];
}

export function voiceLabel(v: VoiceList | null, id: string | undefined): string {
  if (!id) return "Narrator";
  return voiceOptions(v).find((o) => o.id === id)?.label ?? id;
}

/** Rough time to voice `seconds` of speech with a voice, as words. */
export function voiceTime(v: VoiceList | null, id: string, seconds: number): { text: string; slow: boolean } {
  const engine = voiceOptions(v).find((o) => o.id === id)?.engine ?? "edge";
  const factor = v?.realtime[engine] ?? 0.05;
  const s = seconds * factor + (engine === "edge" ? 5 : 20);
  const text = s < 90 ? "under 2 minutes" : s < 3600 ? `about ${Math.round(s / 60)} minutes` : `about ${(s / 3600).toFixed(1)} hours`;
  return { text, slow: s > 1800 };
}

// ── Previews ────────────────────────────────────────────────────────

let audio: HTMLAudioElement | null = null;
let playingKey: string | null = null;
let loadingKey: string | null = null;
const previewListeners = new Set<() => void>();
const emitPreview = () => previewListeners.forEach((l) => l());

export async function playPreview(voice: string, opts: { text?: string; blend?: BlendPart[] } = {}) {
  const key = JSON.stringify([voice, opts]);
  if (playingKey === key && audio) {
    audio.pause();
    playingKey = null;
    emitPreview();
    return;
  }
  audio?.pause();
  playingKey = null;
  loadingKey = key;
  emitPreview();
  try {
    const url = await api.previewVoice(voice, opts);
    if (loadingKey !== key) return;
    audio = new Audio(url);
    audio.onended = () => {
      playingKey = null;
      emitPreview();
    };
    playingKey = key;
    await audio.play();
  } finally {
    if (loadingKey === key) loadingKey = null;
    emitPreview();
  }
}

/** "loading" | "playing" | null for a voice's preview button. */
export function usePreviewState(voice: string, opts: { text?: string; blend?: BlendPart[] } = {}): "loading" | "playing" | null {
  const key = JSON.stringify([voice, opts]);
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    previewListeners.add(l);
    return () => void previewListeners.delete(l);
  }, []);
  return loadingKey === key ? "loading" : playingKey === key ? "playing" : null;
}
