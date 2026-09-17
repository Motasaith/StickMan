// Stickman Studio, an AI video studio that runs on your computer.
// Copyright (c) 2026 Abdul Rauf Azhar <https://github.com/Motasaith>
// Source: https://github.com/Motasaith/StickMan
// SPDX-License-Identifier: AGPL-3.0-or-later
// Keep this notice: AGPL-3.0 sections 5(d) and 7(b), see ATTRIBUTION.md.

// The editor's working area: library on the left, canvas and timeline in the middle, AI Director
// and properties on the right. The editor page shows it full screen; the home page demo embeds it.

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Header } from "./Header";
import { LeftPanel } from "./LeftPanel";
import { Stage } from "./Stage";
import { Timeline } from "./Timeline";
import { RightPanel } from "./RightPanel";
import { ExportDialog } from "./ExportDialog";
import { VersionsDialog } from "./VersionsDialog";
import { importFiles } from "./importFiles";

export function Workspace({ className, onOpenDemo, timelineHeight = 270 }: { className?: string; /** Set in the home page demo. */ onOpenDemo?: () => void; timelineHeight?: number }) {
  const [exportOpen, setExportOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [timelineH, setTimelineH] = useState(timelineHeight);
  const [dragging, setDragging] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const maxTimeline = () => (root.current?.clientHeight ?? window.innerHeight) * 0.6;

  return (
    <div ref={root} className={cn("flex flex-col bg-background", className)}>
      <Header onExport={() => setExportOpen(true)} onVersions={() => setVersionsOpen(true)} onOpenDemo={onOpenDemo} />
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
              const move = (ev: PointerEvent) => setTimelineH(Math.max(150, Math.min(maxTimeline(), startH - (ev.clientY - startY))));
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
      {!onOpenDemo && <VersionsDialog open={versionsOpen} onOpenChange={setVersionsOpen} />}
    </div>
  );
}

