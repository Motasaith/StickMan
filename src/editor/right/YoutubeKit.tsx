// Publishing extras: chapters for the description, subtitle files, a thumbnail maker and a
// vertical Short cut from the video.

import { useState } from "react";
import { useNavigate } from "react-router";
import { Copy, FileText, ImageIcon, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { demoAllows, flushSave, useStore } from "@/store";
import { api } from "@/lib/api";
import { downloadBlob } from "@/export";
import { chaptersText, makeShort, spokenWords, subtitles } from "@/engine/youtube";
import { Section } from "../fields";
import { ThumbnailDialog } from "../ThumbnailDialog";

const fileName = (title: string) => title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "video";

export function YoutubeKit() {
  const scene = useStore((s) => s.scene);
  const title = useStore((s) => s.title);
  const navigate = useNavigate();
  const [thumbOpen, setThumbOpen] = useState(false);
  const [cutting, setCutting] = useState(false);
  if (scene.mode === "3d") return null;
  const chapters = chaptersText(scene);
  const hasWords = spokenWords(scene).length > 0;
  const canShort = scene.width > scene.height && !!scene.slides?.some((s) => /^sc\d+$/.test(s.id));

  const save = (format: "srt" | "vtt") => downloadBlob(new Blob([subtitles(scene, format)], { type: format === "srt" ? "application/x-subrip" : "text/vtt" }), `${fileName(title)}.${format}`);

  const short = async () => {
    const s = useStore.getState();
    const res = makeShort(s.scene, s.assets);
    if (!res || !demoAllows("short")) return;
    setCutting(true);
    try {
      await flushSave();
      const p = await api.createProject({ title: res.scene.title ?? `${s.title} (Short)`, scene: res.scene, assets: s.assets, kind: "video" });
      toast.success(`Short made from the first ${res.scenes} scenes`, {
        description: "The voices are reused, so it is ready to export. Replace the narration if you want a punchier hook.",
        action: { label: "Open it", onClick: () => navigate(`/editor/${p.id}`) },
        duration: 12000,
      });
    } catch (err) {
      toast.error("Couldn't make the Short", { description: (err as Error).message });
    } finally {
      setCutting(false);
    }
  };

  return (
    <Section title="YouTube kit" id="youtube" highlight defaultOpen={!!scene.publish}>
      <div className="grid grid-cols-2 gap-1.5">
        <button className="chip justify-center" onClick={() => setThumbOpen(true)}>
          <ImageIcon className="size-3.5" /> Thumbnail
        </button>
        {canShort && (
          <button className="chip justify-center" disabled={cutting} onClick={short} title="A 9:16 video under a minute, from the opening scenes">
            {cutting ? <Loader2 className="size-3.5 animate-spin" /> : <Smartphone className="size-3.5" />} Make a Short
          </button>
        )}
        <button className="chip justify-center" disabled={!hasWords} onClick={() => save("srt")} title={hasWords ? "Subtitles for YouTube upload" : "Add narration first"}>
          <FileText className="size-3.5" /> Subtitles .srt
        </button>
        <button className="chip justify-center" disabled={!hasWords} onClick={() => save("vtt")}>
          <FileText className="size-3.5" /> Subtitles .vtt
        </button>
      </div>
      <div className="rounded-md border border-line bg-panel-sunken p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Chapters</span>
          {chapters && (
            <button
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              title="Copy the chapters"
              onClick={() => navigator.clipboard.writeText(chapters).then(() => toast.success("Chapters copied. Paste them into the description."))}
            >
              <Copy className="size-3.5" />
            </button>
          )}
        </div>
        {chapters ? (
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5">{chapters}</pre>
        ) : (
          <p className="text-[11px] leading-4 text-muted-foreground">Add at least three timeline markers, 10 seconds or more apart, and they become YouTube chapters.</p>
        )}
      </div>
      <ThumbnailDialog open={thumbOpen} onOpenChange={setThumbOpen} />
    </Section>
  );
}
