import { useEffect } from "react";
import { useStore } from "@/store";
import { cloneScene, findObj } from "@/engine/scene";
import { deleteKeysAt } from "@/engine/tracks";
import { splitAtPlayhead, duplicateObject } from "./actions";

/**
 * Space plays, Ctrl+Z / Ctrl+Shift+Z undo and redo, Delete removes, Esc deselects,
 * S splits the selected clip, Ctrl+D duplicates, M adds a marker, arrows step frames.
 */
export function useEditorKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        s.redo();
      } else if (mod && key === "d" && s.selectedId) {
        e.preventDefault();
        duplicateObject(s.selectedId);
      } else if (e.key === " ") {
        e.preventDefault();
        s.setPlaying(!s.playing);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selectedKey) {
          const next = cloneScene(s.scene);
          const tracks = s.selectedKey.id === "__camera" ? next.camera.tracks : findObj(next, s.selectedKey.id)?.tracks;
          if (tracks) {
            deleteKeysAt(tracks, s.selectedKey.t);
            s.commit(next);
            s.selectKey(null);
          }
        } else if (s.selectedId) {
          if (s.selectedId.startsWith("slide:")) s.run([{ op: "removeSlide", id: s.selectedId.slice(6) }]);
          else s.run([{ op: "remove", id: s.selectedId }]);
        }
      } else if (e.key === "Escape") {
        s.select(null);
      } else if (key === "s" && !mod) {
        splitAtPlayhead();
      } else if (key === "m" && !mod) {
        s.run([{ op: "marker", at: Math.round(s.time * 100) / 100, label: `Marker ${(s.scene.markers?.length ?? 0) + 1}` }]);
      } else if (e.key === "Home") {
        s.setTime(0);
      } else if (e.key === "End") {
        s.setTime(s.scene.duration);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 1 / s.scene.fps;
        s.setTime(s.time + (e.key === "ArrowLeft" ? -step : step));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

