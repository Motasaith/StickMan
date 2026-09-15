import { useEffect } from "react";
import { useStore } from "../store";
import { deleteKeysAt } from "../engine/tracks";
import { cloneScene, findObj } from "../engine/scene";
import { AIPanel } from "./AIPanel";
import { Inspector } from "./Inspector";
import { Stage } from "./Stage";
import { Timeline } from "./Timeline";
import { TopBar } from "./TopBar";

export function App() {
  useKeyboard();
  return (
    <div className="app">
      <TopBar />
      <AIPanel />
      <Stage />
      <Inspector />
      <Timeline />
    </div>
  );
}

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
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
          s.run([{ op: "remove", id: s.selectedId }]);
        }
      } else if (e.key === "Escape") {
        s.select(null);
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
