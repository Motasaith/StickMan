import { useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, ArrowUpRight, Check, CloudOff, Download, History, Loader2, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";
import { LogoMark } from "./Logo";
import { AiTools } from "./AiTools";

function SaveBadge() {
  const status = useStore((s) => s.saveStatus);
  const error = useStore((s) => s.saveError);
  const label = status === "saved" ? "Saved" : status === "saving" ? "Saving…" : status === "pending" ? "Unsaved changes" : "Not saved";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("hidden items-center gap-1 text-xs sm:flex", status === "error" ? "text-warn" : "text-muted-foreground")}>
          {status === "saved" && <Check className="size-3.5" />}
          {status === "saving" && <Loader2 className="size-3.5 animate-spin" />}
          {status === "error" && <CloudOff className="size-3.5" />}
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{error ?? "Your work saves automatically to this computer."}</TooltipContent>
    </Tooltip>
  );
}

function TitleField() {
  const title = useStore((s) => s.title);
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(null);
      return;
    }
    const t = (draft ?? title).trim().slice(0, 100);
    if (t && t !== title) useStore.getState().setTitle(t);
    setDraft(null);
  };
  return (
    <input
      value={draft ?? title}
      onFocus={() => setDraft(title)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          cancelled.current = true;
          (e.target as HTMLInputElement).blur();
        }
      }}
      aria-label="Project name"
      className="w-full min-w-0 max-w-[340px] truncate rounded-md bg-transparent px-2 py-1 font-display text-[15px] font-semibold hover:bg-panel-raised focus:bg-panel-raised focus:outline-none"
    />
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={disabled} onClick={onClick} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function Header({ onExport, onVersions, onOpenDemo }: { onExport: () => void; onVersions: () => void; /** Set in the home page demo. */ onOpenDemo?: () => void }) {
  const demo = !!onOpenDemo;
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const is3d = useStore((s) => s.scene.mode === "3d");
  const sections = useStore((s) => (s.scene.slides?.length ? (s.scene.slides.some((x) => x.layout === "footage") ? "ai video" : "presentation") : null));
  const size = useStore((s) => `${s.scene.width}×${s.scene.height}`);
  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-panel px-3">
      {!demo && (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" asChild aria-label="All projects">
            <Link to="/">
              <ArrowLeft />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>All projects</TooltipContent>
      </Tooltip>
      )}
      <LogoMark className="size-5 text-clip-title" />
      <TitleField />
      {demo ? <span className="rounded bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">Demo, not saved</span> : <SaveBadge />}
      <span className="eyebrow ml-2 hidden lg:flex">
        {size} {sections ? `/ ${sections}` : is3d ? "/ 3d" : ""}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <IconButton label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => useStore.getState().undo()}>
          <Undo2 />
        </IconButton>
        <IconButton label="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => useStore.getState().redo()}>
          <Redo2 />
        </IconButton>
        {!demo && (
          <IconButton label="Version history" onClick={onVersions}>
            <History />
          </IconButton>
        )}
        <div className="mx-1">
          <AiTools />
        </div>
        <div className="mx-2 inline-flex rounded-md border border-line bg-panel-sunken p-0.5" title="Show the scene flat, or as a lit 3D world">
          {(["2d", "3d"] as const).map((m) => (
            <button
              key={m}
              onClick={() => (m === "3d") !== is3d && useStore.getState().run([{ op: "scene", mode: m }])}
              className={cn("rounded px-2.5 py-1 font-mono text-[11px] uppercase transition", (m === "3d") === is3d ? "bg-panel-raised text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {m}
            </button>
          ))}
        </div>
        {demo ? (
          <Button className="ml-1 gap-1.5" onClick={onOpenDemo}>
            Open in editor <ArrowUpRight className="size-4" />
          </Button>
        ) : (
          <Button className="ml-1 gap-1.5" onClick={onExport}>
            <Download className="size-4" /> Export
          </Button>
        )}
      </div>
    </header>
  );
}
