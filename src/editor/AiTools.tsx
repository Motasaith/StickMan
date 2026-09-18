// One place that lists every AI tool in the editor and jumps straight to it, so features
// tucked into panels (drawing, AI pictures, intros, the YouTube kit) are easy to find.

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Captions, Clapperboard, Film, ImageIcon, Mic2, Palette, PenTool, MonitorPlay, Sparkles, Wand2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useStore, type LeftTab } from "@/store";

const SEEN = "stickman-studio.ai-tools-seen";

interface Tool {
  label: string;
  blurb: string;
  icon: typeof Wand2;
  run?: () => void;
  href?: string;
}

const left = (tab: LeftTab, after?: () => void) => () => {
  useStore.getState().setLeftTab(tab);
  if (after) setTimeout(after, 60);
};
const director = (text: string) => () => {
  useStore.getState().setMode("ai");
  setTimeout(() => window.dispatchEvent(new CustomEvent("stickman-director-prompt", { detail: text })), 60);
};
const section = (id: string) => () => {
  const s = useStore.getState();
  s.select(null);
  s.setMode("edit");
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent("stickman-open-section", { detail: id }));
    setTimeout(() => document.querySelector(`[data-section="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
  }, 60);
};
const focus = (selector: string) => () => document.querySelector<HTMLElement>(selector)?.focus();

const TOOLS: Tool[] = [
  { label: "AI Director", blurb: "Describe any edit in words", icon: Wand2, run: director("") },
  { label: "Draw with AI", blurb: "A new animated illustration", icon: PenTool, run: left("illustrations", focus("[data-ai-draw]")) },
  { label: "AI pictures", blurb: "Generate a photo or background", icon: ImageIcon, run: left("stock", () => window.dispatchEvent(new CustomEvent("stickman-stock-source", { detail: "ai" }))) },
  { label: "B-roll finder", blurb: "Pexels, Wikimedia, NASA, Openverse", icon: Film, run: left("stock") },
  { label: "Intros and outros", blurb: "Animated title and end screens", icon: Clapperboard, run: section("intro") },
  { label: "YouTube kit", blurb: "Thumbnail, Short, subtitles, chapters", icon: MonitorPlay, run: section("youtube") },
  { label: "Captions and voice", blurb: "Narration with word-timed captions", icon: Captions, run: director("Add a natural narration voice and word-by-word captions") },
  { label: "Restyle the video", blurb: "Themes, color looks, transitions", icon: Palette, run: director("Give this video a more cinematic look with smoother transitions") },
  { label: "Voice studio", blurb: "Blend or clone your own voice", icon: Mic2, href: "/voices" },
  { label: "New AI video", blurb: "Idea or script to finished video", icon: Sparkles, href: "/create" },
];

export function AiTools() {
  const demo = useStore((s) => s.demo);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    try {
      setSeen(localStorage.getItem(SEEN) === "1");
    } catch {
      setSeen(true);
    }
  }, []);
  const onOpen = (o: boolean) => {
    setOpen(o);
    if (o && !seen) {
      setSeen(true);
      try {
        localStorage.setItem(SEEN, "1");
      } catch {
        /* storage unavailable */
      }
    }
  };
  // Links leave the page; the demo keeps visitors on it.
  const tools = demo ? TOOLS.filter((t) => !t.href) : TOOLS;
  return (
    <Popover open={open} onOpenChange={onOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative gap-1.5 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary">
          <Sparkles className="size-4" /> AI tools
          {!seen && <span className="absolute -right-1 -top-1 size-2.5 animate-pulse-dot rounded-full bg-primary" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-2">
        <p className="px-2 pb-2 pt-1 text-xs text-muted-foreground">Everything the AI can do here. Pick one to jump to it.</p>
        <div className="grid grid-cols-2 gap-1">
          {tools.map((t) => {
            const body = (
              <>
                <t.icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium leading-tight">{t.label}</span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">{t.blurb}</span>
                </span>
              </>
            );
            const cls = "flex items-start gap-2 rounded-md p-2 text-left transition hover:bg-accent";
            return t.href ? (
              <Link key={t.label} to={t.href} className={cls} onClick={() => setOpen(false)}>
                {body}
              </Link>
            ) : (
              <button
                key={t.label}
                className={cls}
                onClick={() => {
                  setOpen(false);
                  t.run?.();
                }}
              >
                {body}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
