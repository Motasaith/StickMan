// The editor: library on the left, canvas and timeline in the middle, AI Director and
// properties on the right.

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { flushSave, useStore, type LeftTab } from "@/store";
import type { Scene } from "@/engine/scene";
import { Header } from "@/editor/Header";
import { LeftPanel } from "@/editor/LeftPanel";
import { Stage } from "@/editor/Stage";
import { Timeline } from "@/editor/Timeline";
import { RightPanel } from "@/editor/RightPanel";
import { ExportDialog } from "@/editor/ExportDialog";
import { VersionsDialog } from "@/editor/VersionsDialog";
import { useEditorKeys } from "@/editor/keys";
import { askAnimator } from "@/ai";
import { captureThumbnail } from "@/editor/thumbnail";
import { importFiles } from "@/editor/importFiles";

export default function Editor() {
  const { projectId = "" } = useParams();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [timelineH, setTimelineH] = useState(270);
  const [dragging, setDragging] = useState(false);
  const firstPrompt = useRef(search.get("prompt"));

  useEditorKeys();

  useEffect(() => {
    document.documentElement.classList.add("theme-editor");
    return () => document.documentElement.classList.remove("theme-editor");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    api
      .getProject(projectId)
      .then((p) => {
        if (cancelled) return;
        useStore.getState().loadProject({ id: p.id, title: p.title, kind: p.kind, scene: p.scene as Scene, assets: p.assets ?? [] });
        const tab = search.get("tab") as LeftTab | null;
        const s = useStore.getState();
        s.setLeftTab(tab ?? (p.kind === "presentation" ? "slides" : p.kind === "video" ? "media" : "characters"));
        setReady(true);
        if (!p.thumbnail) setTimeout(() => void captureThumbnail(), 1500);
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // A prompt from the projects page runs once, then leaves the address bar.
  useEffect(() => {
    if (!ready) return;
    const p = firstPrompt.current;
    if (search.has("prompt") || search.has("tab")) {
      search.delete("prompt");
      search.delete("tab");
      setSearch(search, { replace: true });
    }
    if (p) {
      firstPrompt.current = null;
      useStore.getState().setMode("ai");
      void askAnimator(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Keep the projects page thumbnail fresh while working.
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      if (useStore.getState().saveStatus === "saved") void captureThumbnail();
    }, 45_000);
    return () => clearInterval(id);
  }, [ready]);

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (useStore.getState().saveStatus !== "saved") {
        void flushSave();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="size-8 text-warn" />
        <p className="text-lg font-medium">This project could not be opened.</p>
        <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
        <Button onClick={() => navigate("/")}>Back to projects</Button>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-[640px] flex-col bg-background">
      <Header onExport={() => setExportOpen(true)} onVersions={() => setVersionsOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <LeftPanel />
        <main
          className="relative flex min-w-0 flex-1 flex-col"
          onDragEnter={(e) => e.dataTransfer.types.includes("Files") && setDragging(true)}
        >
          {dragging && (
            <div
              className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm"
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files.length) void importFiles(e.dataTransfer.files, { place: true });
              }}
            >
              <div className="pointer-events-none rounded-2xl border-2 border-dashed border-primary px-10 py-8 text-center">
                <p className="font-display text-xl font-semibold">Drop videos, pictures, sounds or SVGs</p>
                <p className="text-sm text-muted-foreground">They go into the media library and onto the canvas at the playhead.</p>
              </div>
            </div>
          )}
          <Stage />
          <div
            className="h-1.5 shrink-0 cursor-row-resize border-t border-line bg-panel hover:bg-primary/30"
            onPointerDown={(e) => {
              const startY = e.clientY;
              const startH = timelineH;
              const move = (ev: PointerEvent) => setTimelineH(Math.max(150, Math.min(window.innerHeight * 0.6, startH - (ev.clientY - startY))));
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
          />
          <section className="shrink-0 bg-panel" style={{ height: timelineH }}>
            <Timeline />
          </section>
        </main>
        <RightPanel />
      </div>
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <VersionsDialog open={versionsOpen} onOpenChange={setVersionsOpen} />
    </div>
  );
}

