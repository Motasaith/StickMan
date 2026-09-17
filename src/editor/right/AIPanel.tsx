import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Trash2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";
import { askAnimator } from "@/ai";
import { findObj } from "@/engine/scene";

const SUGGESTIONS: Record<string, string[]> = {
  empty: [
    "Make a 6-slide presentation for a dentist about caring for your teeth, with narration and captions",
    "A classroom: a teacher writes 2+2=4 on the board and asks a student, who answers \"Four!\"",
    "A 3D street at sunset: a boy walks to a bakery and chats with the baker",
    "An explainer about saving energy with a stick man, stickers and a growing bar chart",
  ],
  video: ["Cut the boring start and add word-by-word captions", "Make it vertical for TikTok and add a big title", "Blur the faces and add a name bar for the speaker", "Add a cinematic color grade and fade in and out"],
  slides: ["Add a slide with a pie chart of the survey results", "Make the narration friendlier and shorter", "Switch to the midnight theme", "Add captions in the highlight style"],
  footage: ["Add a neon intro and a 10-second end screen", "Swap the b-roll in scene 2 for city skyline shots", "Use glitch transitions between the scenes", "Make the captions karaoke style and bigger"],
  scene: ["Make the characters wave and say hello", "Add a thumbs up sticker when they finish", "Add confetti and applause at the end", "Zoom the camera in slowly"],
};

export function AIPanel() {
  const chat = useStore((s) => s.chat);
  const busy = useStore((s) => s.aiBusy);
  const review = useStore((s) => s.review);
  const voices = useStore((s) => s.voices);
  const selected = useStore((s) => (s.selectedId && !s.selectedId.startsWith("slide:") ? findObj(s.scene, s.selectedId)?.name : undefined));
  const kind = useStore((s) => (s.scene.slides?.some((x) => x.layout === "footage") ? "footage" : s.scene.slides?.length ? "slides" : s.scene.objects.some((o) => o.type === "video") ? "video" : s.scene.objects.length ? "scene" : "empty"));
  const [prompt, setPrompt] = useState("");
  const [health, setHealth] = useState<{ configured: boolean; model: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const demo = useStore((s) => s.demo);
  const aiUsed = useStore((s) => s.demoUses.ai ?? 0);

  // Other tools (the AI tools menu) can start a request here.
  useEffect(() => {
    const fill = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (typeof text === "string") setPrompt(text);
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    window.addEventListener("stickman-director-prompt", fill);
    return () => window.removeEventListener("stickman-director-prompt", fill);
  }, []);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ configured: false, model: "" }));
  }, []);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chat]);

  const send = (text = prompt) => {
    const p = text.trim();
    if (!p || busy) return;
    setPrompt("");
    void askAnimator(p);
  };

  return (
    <>
      <div className="flex items-start gap-3 border-b border-line px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Wand2 className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-semibold">AI Director</p>
          <p className="text-xs text-muted-foreground">Say what you want. I'll build it on the timeline.</p>
        </div>
        <span className={cn("mt-1 flex items-center gap-1.5 text-[11px]", health?.configured ? "text-good" : "text-warn")} title={health?.model}>
          <span className={cn("size-1.5 rounded-full", health?.configured ? "bg-good" : "bg-warn")} />
          {health ? (health.configured ? "ready" : "not set up") : "…"}
        </span>
        {chat.length > 0 && (
          <button className="rounded p-1 text-muted-foreground hover:text-foreground" title="Clear conversation" onClick={() => useStore.getState().clearChat()}>
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {chat.length === 0 ? (
          <div className="animate-rise-in">
            <p className="eyebrow mb-3">Your first edit starts here</p>
            <p className="font-serif text-[28px] italic leading-tight">What would you make?</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Animate stick figures and characters, build a narrated presentation with animated illustrations, edit your uploaded clips, or shoot a 3D film. Everything the AI makes stays editable.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {chat.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "animate-rise-in whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                  m.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-4 border border-line bg-panel-raised",
                  m.error && "border-destructive/60 text-destructive"
                )}
              >
                {m.pending && <Loader2 className="mr-1.5 inline size-3.5 animate-spin align-[-2px]" />}
                <span className={cn(m.pending && "shimmer-text")}>{m.text}</span>
                {m.changes && m.changes.length > 0 && (
                  <details className="mt-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none">
                      {m.changes.filter((c) => c.ok).length} changes{m.changes.some((c) => !c.ok) ? `, ${m.changes.filter((c) => !c.ok).length} skipped` : ""}
                    </summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {m.changes.map((c, i) => (
                        <li key={i} className={c.ok ? "" : "text-destructive"}>
                          {c.message}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-line px-3 pb-3 pt-2.5">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS[kind].map((s) => (
            <button key={s} className="chip h-auto max-w-full truncate py-1 text-left text-[11px]" disabled={busy} onClick={() => send(s)} title={s}>
              <span className="truncate">{s}</span>
            </button>
          ))}
        </div>
        <div className={cn("rounded-xl border border-line bg-panel-sunken p-2 transition focus-within:border-ring", busy && "ai-glow")}>
          {selected && <span className="mb-1.5 inline-block rounded-md bg-panel-raised px-2 py-0.5 text-[11px] text-muted-foreground">Editing: {selected}</span>}
          <textarea
            ref={inputRef}
            data-ai-prompt
            className="block max-h-40 min-h-[64px] w-full resize-none bg-transparent px-1 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
            placeholder={busy ? "Working on it…" : "Tell me what to make or change…"}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <div className="flex items-center gap-3 px-1 pt-1">
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground" title="Speak speech bubbles and narration aloud">
              <input type="checkbox" checked={voices} onChange={(e) => useStore.getState().setVoices(e.target.checked)} /> Voices
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground" title="After building, the AI looks at frames and fixes what it sees">
              <input type="checkbox" checked={review} onChange={(e) => useStore.getState().setReview(e.target.checked)} /> Check its work
            </label>
            {demo && <span className="text-[11px] text-primary">{Math.max(0, 3 - aiUsed)} of 3 demo requests left</span>}
            <button
              className="ml-auto flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:scale-105 disabled:opacity-40"
              disabled={busy || !prompt.trim()}
              onClick={() => send()}
              aria-label="Send"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
