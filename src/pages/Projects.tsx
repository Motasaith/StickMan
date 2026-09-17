// The home page: say what to make, start from a template, or open a recent project.

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowUpRight, Copy, Film, Loader2, MoreHorizontal, Pencil, Presentation, Sparkles, Trash2, Clapperboard, Box, Smartphone, PersonStanding, Wand2, Mic2, ImagePlus, Palette } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api, type ProjectSummary } from "@/lib/api";
import { cn } from "@/lib/utils";
import { emptyScene, type Scene } from "@/engine/scene";
import { applyOps } from "@/engine/ops";
import { Logo } from "@/editor/Logo";
import { HomeDemo } from "@/home/HomeDemo";
import { DEMO_DECK } from "@/home/demoScene";

type Kind = "ai" | "animation" | "presentation" | "video" | "3d";
type Format = "16:9" | "9:16" | "1:1";

const KINDS: { id: Kind; label: string; icon: typeof Film; placeholder: string }[] = [
  { id: "ai", label: "AI video", icon: Wand2, placeholder: "A mini-documentary about the video rental giant that turned down Netflix…" },
  { id: "animation", label: "Animation", icon: PersonStanding, placeholder: "A teacher walks to the board, writes 2+2=4 and asks the class a question…" },
  { id: "presentation", label: "Presentation", icon: Presentation, placeholder: "A 6-slide presentation for a dentist about caring for your teeth, with narration…" },
  { id: "video", label: "Video edit", icon: Clapperboard, placeholder: "Upload clips, then: cut the boring start, add captions and a title…" },
  { id: "3d", label: "3D film", icon: Box, placeholder: "A 3D street at sunset: a boy walks to a bakery and chats with the baker…" },
];

function sceneFor(format: Format): Scene {
  return format === "9:16" ? emptyScene(1080, 1920) : format === "1:1" ? emptyScene(1080, 1080) : emptyScene(1280, 720);
}

function titleFrom(prompt: string): string {
  const t = prompt.replace(/\s+/g, " ").trim().split(/[.:!?]/)[0].slice(0, 48);
  return t ? t[0].toUpperCase() + t.slice(1) : "Untitled project";
}

interface Template {
  id: string;
  title: string;
  blurb: string;
  kind: Kind;
  format: Format;
  icon: typeof Film;
  tone: string;
  build?: () => Scene;
  prompt?: string;
  /** Opens this page instead of a new project. */
  href?: string;
}

const AI_FEATURES: { title: string; blurb: string; icon: typeof Film; href: string; tag: string }[] = [
  { title: "AI video maker", blurb: "An idea, your script or your recording becomes an edited video with b-roll, music and captions.", icon: Wand2, href: "/create", tag: "YouTube" },
  { title: "Voice studio", blurb: "40 natural voices, blends no other channel has, and cloning from 10 seconds of speech.", icon: Mic2, href: "/voices", tag: "Voices" },
  { title: "AI Director", blurb: "Say what to change and it edits the timeline: scenes, captions, transitions, grades.", icon: Sparkles, href: "#demo", tag: "Editor" },
  { title: "Thumbnails and Shorts", blurb: "Four thumbnail layouts, a vertical Short from any video, chapters and subtitle files.", icon: ImagePlus, href: "#demo", tag: "Publish" },
  { title: "AI pictures and drawings", blurb: "Generate photos and backgrounds, or animated illustrations that match your slides.", icon: Palette, href: "#demo", tag: "Visuals" },
  { title: "B-roll finder", blurb: "Clips and photos from Pexels, Wikimedia, NASA and Openverse, with credits kept.", icon: Film, href: "#demo", tag: "Footage" },
  { title: "Animated intros", blurb: "Eight title sequences and three outros, including a YouTube end screen.", icon: Clapperboard, href: "/create", tag: "Branding" },
  { title: "Presentations", blurb: "Narrated slide decks with animated illustrations and captions, from one sentence.", icon: Presentation, href: "#templates", tag: "Slides" },
];

const TEMPLATES: Template[] = [
  { id: "faceless", title: "Faceless YouTube video", blurb: "AI script, voice, stock footage and editing, ready to export", kind: "video", format: "16:9", icon: Wand2, tone: "bg-[#f6dccb]", href: "/create" },
  { id: "blank", title: "Blank canvas", blurb: "Start empty, 16:9", kind: "animation", format: "16:9", icon: Pencil, tone: "bg-[#e9e4d8]" },
  { id: "deck", title: "Presentation", blurb: "A narrated slide deck with animated illustrations", kind: "presentation", format: "16:9", icon: Presentation, tone: "bg-[#d9efe9]", build: () => applyOps(emptyScene(), DEMO_DECK).scene },
  {
    id: "explainer",
    title: "Whiteboard explainer",
    blurb: "A stick man teaches with a board and props",
    kind: "animation",
    format: "16:9",
    icon: PersonStanding,
    tone: "bg-[#f4e3cf]",
    prompt: "A friendly teacher stick man walks to a whiteboard, writes \"Save energy\", then explains three tips while pointing. Add a lightbulb sticker and a happy ending.",
  },
  { id: "film3d", title: "3D short film", blurb: "Lit 3D set, camera shots, voices", kind: "3d", format: "16:9", icon: Box, tone: "bg-[#dfe3f3]", prompt: "A 3D park at golden hour: a girl sits on a bench, her dog brings a ball, they play fetch and she laughs. Use cinematic shots." },
  { id: "short", title: "Social short", blurb: "Vertical 9:16 with bold captions", kind: "video", format: "9:16", icon: Smartphone, tone: "bg-[#f3dde4]" },
  { id: "edit", title: "Edit my videos", blurb: "Upload clips, trim, caption, export", kind: "video", format: "16:9", icon: Clapperboard, tone: "bg-[#efe6cf]" },
];

/** In-page anchors scroll; other links route. */
function FeatureLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return href.startsWith("#") ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

function ago(ms: number): string {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString();
}

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<Kind>("ai");
  const [format, setFormat] = useState<Format>("16:9");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.remove("theme-editor");
    api.listProjects().then(setProjects).catch((e) => {
      setProjects([]);
      toast.error("Couldn't load your projects", { description: (e as Error).message });
    });
  }, []);

  const create = async (opts: { title: string; scene: Scene; kind: Kind; prompt?: string; tab?: string }, key: string) => {
    setBusy(key);
    try {
      const { id } = await api.createProject({ title: opts.title, scene: opts.scene, assets: [], kind: opts.kind });
      const q = new URLSearchParams();
      if (opts.prompt) q.set("prompt", opts.prompt);
      if (opts.tab) q.set("tab", opts.tab);
      navigate(`/editor/${id}${q.size ? `?${q}` : ""}`);
    } catch (err) {
      toast.error("Couldn't create the project", { description: (err as Error).message });
      setBusy(null);
    }
  };

  const start = () => {
    const p = prompt.trim();
    if (!p) return;
    if (kind === "ai") return navigate(`/create?prompt=${encodeURIComponent(p)}&format=${format === "9:16" ? "9:16" : "16:9"}`);
    const scene = sceneFor(format);
    if (kind === "3d") scene.mode = "3d";
    // The chosen kind steers the AI when the words alone don't say it.
    const ask = kind === "presentation" && !/presentation|slides?|deck/i.test(p) ? `Make a narrated presentation: ${p}` : kind === "3d" && !/3d/i.test(p) ? `In 3D: ${p}` : p;
    void create({ title: titleFrom(p), scene, kind, prompt: ask, tab: kind === "video" ? "media" : kind === "presentation" ? "slides" : undefined }, "prompt");
  };

  const placeholder = KINDS.find((k) => k.id === kind)!.placeholder;

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto max-w-[1200px] px-6">
        <header className="flex h-[88px] items-center justify-between border-b border-line">
          <Logo className="h-7" />
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/create" className="flex items-center gap-1.5 hover:text-primary">
              <Wand2 className="size-4" /> AI video
            </Link>
            <Link to="/voices" className="flex items-center gap-1.5 hover:text-primary">
              <Mic2 className="size-4" /> Voice studio
            </Link>
            <a href="#demo" className="hover:text-primary">Live editor</a>
            <a href="#templates" className="hover:text-primary">Templates</a>
            <a href="#projects" className="hover:text-primary">Your projects</a>
            <Button className="gap-2 rounded-none px-5" onClick={() => create({ title: "Untitled project", scene: sceneFor("16:9"), kind: "animation" }, "new")} disabled={!!busy}>
              New project <ArrowUpRight className="size-4" />
            </Button>
          </nav>
        </header>

        <section className="grid gap-10 py-14 lg:grid-cols-[1.25fr_1fr] lg:items-end">
          <div>
            <p className="eyebrow mb-6">
              <span className="eyebrow-dot" /> Create · Animate · Present · Edit
            </p>
            <h1 className="font-display text-[64px] font-bold leading-[0.95] sm:text-[88px]">
              Say it.
              <br />
              <span className="text-primary">Watch it </span>
              <span className="serif-accent">move.</span>
            </h1>
          </div>
          <p className="max-w-md pb-2 text-[15px] leading-7 text-muted-foreground">
            Give the AI an idea and it writes, voices and edits a faceless YouTube video from stock footage. Describe a scene and it animates stick figures, characters and 3D worlds. Ask for a presentation and it designs narrated slides with animated illustrations. Or bring your own clips and edit them like a pro. Everything stays editable on a real timeline.
          </p>
        </section>

        <section className="border border-line bg-panel p-5 shadow-[6px_6px_0_0_hsl(var(--line))]">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                className={cn("flex items-center gap-2 border px-3 py-1.5 text-sm transition", kind === k.id ? "border-foreground bg-foreground text-background" : "border-line hover:border-foreground")}
              >
                <k.icon className="size-4" /> {k.label}
              </button>
            ))}
            <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              Format
              {(["16:9", "9:16", "1:1"] as Format[]).map((f) => (
                <button key={f} onClick={() => setFormat(f)} className={cn("ml-1 border px-2 py-1 font-mono", format === f ? "border-primary text-primary" : "border-line")}>
                  {f}
                </button>
              ))}
            </span>
          </div>
          <div className="flex items-end gap-3">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  start();
                }
              }}
              rows={3}
              placeholder={placeholder}
              className="min-h-[88px] flex-1 resize-none border-0 bg-transparent text-lg leading-relaxed outline-none placeholder:text-muted-foreground/70"
            />
            <Button size="lg" className="h-12 gap-2 rounded-none px-6" disabled={!prompt.trim() || !!busy} onClick={start}>
              {busy === "prompt" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Make it
            </Button>
          </div>
        </section>

        <section id="ai" className="pt-14">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="eyebrow mb-2">
                <span className="eyebrow-dot" /> AI features
              </p>
              <h2 className="font-display text-3xl font-semibold">The AI does the heavy lifting</h2>
            </div>
            <p className="max-w-md text-sm text-muted-foreground">Each one is a click away here, and in the editor under the AI tools button.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {AI_FEATURES.map((f) => (
              <FeatureLink key={f.title} href={f.href} className="group flex flex-col gap-2 border border-line bg-panel p-4 transition hover:-translate-y-0.5 hover:border-foreground hover:shadow-[4px_4px_0_0_hsl(var(--foreground))]">
                <span className="flex items-center justify-between">
                  <f.icon className="size-5 text-primary" strokeWidth={1.75} />
                  <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{f.tag}</span>
                </span>
                <span className="font-display text-[17px] font-semibold leading-tight">{f.title}</span>
                <span className="text-[13px] leading-5 text-muted-foreground">{f.blurb}</span>
              </FeatureLink>
            ))}
          </div>
        </section>
      </div>

      <section id="demo" className="mx-auto max-w-[1560px] px-6 pt-16">
        <div className="mx-auto mb-6 flex max-w-[1200px] flex-wrap items-end justify-between gap-2">
          <div>
            <p className="eyebrow mb-2">
              <span className="eyebrow-dot" /> Live editor
            </p>
            <h2 className="font-display text-3xl font-semibold">Try the real editor on a finished AI video</h2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">
            Play it, ask the AI Director for changes, add stickers, swap b-roll or open the AI tools. Each tool works a few times here; open it in the editor to keep going.
          </p>
        </div>
        <HomeDemo />
      </section>

      <div className="mx-auto max-w-[1200px] px-6">
        <section id="templates" className="py-16">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="eyebrow mb-2">01 / Start from</p>
              <h2 className="font-display text-3xl font-semibold">Templates</h2>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                disabled={!!busy}
                onClick={() => {
                  if (t.href) return navigate(t.href);
                  const scene = t.build ? t.build() : sceneFor(t.format);
                  if (t.kind === "3d") scene.mode = "3d";
                  if (t.id === "short") scene.background = "#111111";
                  void create({ title: t.title, scene, kind: t.kind, prompt: t.prompt, tab: t.kind === "video" ? "media" : t.kind === "presentation" ? "slides" : undefined }, t.id);
                }}
                className="group flex flex-col border border-line bg-panel text-left transition hover:-translate-y-0.5 hover:border-foreground hover:shadow-[4px_4px_0_0_hsl(var(--foreground))]"
              >
                <div className={cn("flex h-36 items-center justify-center", t.tone)}>
                  {busy === t.id ? <Loader2 className="size-8 animate-spin" /> : <t.icon className="size-10 opacity-70 transition group-hover:scale-110" strokeWidth={1.5} />}
                </div>
                <div className="flex items-start justify-between gap-3 p-4">
                  <div>
                    <p className="font-display text-lg font-semibold">{t.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{t.blurb}</p>
                  </div>
                  <span className="mt-1 font-mono text-[10px] text-muted-foreground">{t.format}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section id="projects" className="pb-24">
          <p className="eyebrow mb-2">02 / Continue</p>
          <h2 className="mb-6 font-display text-3xl font-semibold">Your projects</h2>
          {projects === null ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : projects.length === 0 ? (
            <p className="text-muted-foreground">Nothing yet. Describe something above or pick a template.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {projects.map((p) => (
                <ProjectCard key={p.id} p={p} onOpen={() => navigate(`/editor/${p.id}`)} onChanged={() => api.listProjects().then(setProjects)} />
              ))}
            </div>
          )}
        </section>
      </div>
      <footer className="border-t border-line py-6 text-center text-xs text-muted-foreground">Stickman Studio · runs on your computer · emoji by Twemoji (CC-BY 4.0)</footer>
    </div>
  );
}

function ProjectCard({ p, onOpen, onChanged }: { p: ProjectSummary; onOpen: () => void; onChanged: () => void }) {
  const ratio = p.format === "9:16" ? "aspect-[9/16] max-h-56" : p.format === "1:1" ? "aspect-square" : "aspect-video";
  return (
    <div className="group border border-line bg-panel transition hover:border-foreground">
      <button onClick={onOpen} className={cn("checker flex w-full items-center justify-center overflow-hidden", ratio)}>
        {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-full w-full object-cover" /> : <Film className="size-8 text-white/40" />}
      </button>
      <div className="flex items-start gap-2 p-3">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate font-medium">{p.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ago(p.updatedAt)}
            {p.duration ? ` · ${Math.round(p.duration)}s` : ""}
            {p.format ? ` · ${p.format}` : ""}
          </p>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Project menu">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={async () => {
                const title = prompt("Rename project", p.title);
                if (title?.trim()) {
                  await api.saveProject(p.id, { title: title.trim() });
                  onChanged();
                }
              }}
            >
              <Pencil /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                await api.duplicateProject(p.id);
                onChanged();
              }}
            >
              <Copy /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={async () => {
                if (!confirm(`Delete "${p.title}"? This can't be undone.`)) return;
                await api.deleteProject(p.id);
                onChanged();
              }}
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
