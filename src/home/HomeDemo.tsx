// The home page demo: the real editor on a sample video. Visitors can play it, try every tool a
// few times and ask the AI Director for edits; nothing is saved until they open it for real.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowUpRight, Loader2, Monitor } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, type ProjectData } from "@/lib/api";
import { useStore } from "@/store";
import type { Scene } from "@/engine/scene";
import { Workspace } from "@/editor/Workspace";
import { installDemoLimits } from "@/demo";
import { deckScene } from "./demoScene";

/** The editor needs about this much width to lay out its three columns. */
const MIN_WIDTH = 1080;
const PORTAL = '[data-slot$="content"], [data-slot$="overlay"], [data-radix-popper-content-wrapper], [data-sonner-toaster]';

export function HomeDemo() {
  const navigate = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [wide, setWide] = useState(true);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWide(el.clientWidth >= MIN_WIDTH));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load the sample into the editor store in demo mode (never saved, limited uses).
  useEffect(() => {
    let cancelled = false;
    const uninstall = installDemoLimits();
    fetch("/api/demo")
      .then((r) => (r.ok ? (r.json() as Promise<Pick<ProjectData, "title" | "scene" | "assets" | "kind">>) : null))
      .catch(() => null)
      .then((p) => {
        if (cancelled) return;
        const s = useStore.getState();
        if (p) s.loadProject({ title: p.title, kind: p.kind, scene: p.scene as Scene, assets: p.assets ?? [], demo: true });
        else s.loadProject({ title: "Healthy Smiles", kind: "presentation", scene: deckScene(), assets: [], demo: true });
        s.setLeftTab(p ? "media" : "slides");
        s.setMode("ai");
        s.setTime(Math.min(2.5, useStore.getState().scene.duration));
        setReady(true);
      });
    return () => {
      cancelled = true;
      uninstall();
      useStore.setState({ demo: false, playing: false });
    };
  }, []);

  // Menus and dialogs opened from the demo use the editor's dark colors.
  useEffect(() => {
    const root = document.documentElement;
    const down = (e: Event) => {
      const t = e.target as Element | null;
      if (!t) return;
      if (box.current?.contains(t)) root.setAttribute("data-demo-active", "");
      else if (!t.closest(PORTAL)) root.removeAttribute("data-demo-active");
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("click", down, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("click", down, true);
      root.removeAttribute("data-demo-active");
    };
  }, []);

  const open = async () => {
    if (opening) return;
    setOpening(true);
    const s = useStore.getState();
    try {
      s.setPlaying(false);
      const { id } = await api.createProject({ title: s.title, scene: s.scene, assets: s.assets, kind: s.kind });
      navigate(`/editor/${id}`);
    } catch (err) {
      toast.error("Couldn't open it in the editor", { description: (err as Error).message });
      setOpening(false);
    }
  };
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    const go = () => void openRef.current();
    window.addEventListener("stickman-open-demo", go);
    return () => window.removeEventListener("stickman-open-demo", go);
  }, []);

  return (
    <div ref={box} className="theme-editor-scope overflow-hidden rounded-xl border border-line shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)]">
      {!ready ? (
        <div className="flex h-[780px] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : wide ? (
        <Workspace className="h-[780px]" timelineHeight={210} onOpenDemo={open} />
      ) : (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <Monitor className="size-8 text-primary" />
          <p className="font-display text-lg font-semibold">The live editor needs a wider screen</p>
          <p className="max-w-sm text-sm text-muted-foreground">Open the sample video in the editor to play it and try the AI tools.</p>
          <Button className="gap-2" disabled={opening} onClick={open}>
            {opening ? <Loader2 className="size-4 animate-spin" /> : <ArrowUpRight className="size-4" />} Open the sample
          </Button>
        </div>
      )}
    </div>
  );
}
