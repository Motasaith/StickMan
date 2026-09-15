import { useRef } from "react";
import { AudioLines, FileCode2, Loader2, PersonStanding, Plus, Trash2, Upload, Video } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/store";
import type { Asset } from "@/engine/scene";
import { importFiles, placeAsset, ACCEPTED_FILES } from "../importFiles";
import { PanelHeader, GroupLabel } from "./common";
import { PuppetSetup } from "../PuppetSetup";

function fmtDur(s?: number) {
  if (!s) return "";
  return s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : `${s.toFixed(1)}s`;
}

export function MediaTab() {
  const assets = useStore((s) => s.assets);
  const uploads = useStore((s) => s.uploads);
  const fileRef = useRef<HTMLInputElement>(null);
  const [puppet, setPuppet] = useState<Asset | null>(null);
  const visible = assets.filter((a) => a.origin !== "tts");
  const groups: { label: string; items: Asset[] }[] = [
    { label: "Videos", items: visible.filter((a) => a.kind === "video") },
    { label: "Pictures", items: visible.filter((a) => !a.kind || a.kind === "image") },
    { label: "Drawings", items: visible.filter((a) => a.kind === "svg") },
    { label: "Sounds", items: visible.filter((a) => a.kind === "audio") },
  ];
  return (
    <>
      <PanelHeader title="Media" subtitle="Your videos, pictures, sounds and drawings. Click to add at the playhead.">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-line py-4 text-sm transition hover:border-primary/60 hover:bg-accent"
        >
          <Upload className="size-5 text-primary" />
          <span className="font-medium">Upload files</span>
          <span className="text-[11px] text-muted-foreground">MP4, MOV, WebM · PNG, JPG, SVG · MP3, WAV</span>
        </button>
        <input ref={fileRef} type="file" hidden multiple accept={ACCEPTED_FILES} onChange={(e) => e.target.files && void importFiles(e.target.files).finally(() => (e.target.value = ""))} />
      </PanelHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {uploads.map((u) => (
          <div key={u.id} className="mb-2 rounded-lg border border-line bg-panel-sunken p-2 text-xs">
            <div className="flex items-center gap-2">
              {!u.error && <Loader2 className="size-3.5 animate-spin text-primary" />}
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              <span className="text-muted-foreground">{u.error ? "failed" : u.progress >= 1 ? "processing" : `${Math.round(u.progress * 100)}%`}</span>
            </div>
            {!u.error && (
              <div className="mt-1.5 h-1 overflow-hidden rounded bg-line">
                <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(u.progress * 100)}%` }} />
              </div>
            )}
            {u.error && <p className="mt-1 text-destructive">{u.error}</p>}
          </div>
        ))}
        {visible.length === 0 && uploads.length === 0 && (
          <p className="text-sm leading-relaxed text-muted-foreground">Nothing here yet. Upload your own files, grab something from Stock, or record your voice. The AI can use everything in this library: mention it by name.</p>
        )}
        {groups.map(
          (g) =>
            g.items.length > 0 && (
              <div key={g.label}>
                <GroupLabel>
                  {g.label} ({g.items.length})
                </GroupLabel>
                <div className={g.label === "Sounds" ? "flex flex-col gap-1.5" : "grid grid-cols-2 gap-2"}>
                  {g.items.map((a) => (g.label === "Sounds" ? <SoundItem key={a.id} a={a} /> : <MediaItem key={a.id} a={a} onPuppet={() => setPuppet(a)} />))}
                </div>
              </div>
            )
        )}
      </div>
      {puppet && <PuppetSetup asset={puppet} onClose={() => setPuppet(null)} />}
    </>
  );
}

function MediaItem({ a, onPuppet }: { a: Asset; onPuppet: () => void }) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-line bg-panel-sunken">
      <button className="checker block aspect-video w-full" onClick={() => placeAsset(a)} title={`Add ${a.name}`}>
        {a.kind === "video" ? (
          a.filmstrip ? (
            <div className="h-full w-full" style={{ backgroundImage: `url(${a.filmstrip})`, backgroundSize: `${(a.frames ?? 1) * 100}% 100%`, backgroundPosition: "0 0" }} />
          ) : (
            <Video className="m-auto size-6 text-white/60" />
          )
        ) : a.kind === "svg" ? (
          a.svg ? <img src={`data:image/svg+xml;utf8,${encodeURIComponent(a.svg)}`} className="h-full w-full object-contain p-2" alt="" /> : <FileCode2 className="m-auto size-6 text-white/60" />
        ) : (
          <img src={a.src} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
      </button>
      <div className="flex items-center gap-1 px-1.5 py-1 text-[11px]">
        <span className="min-w-0 flex-1 truncate" title={a.credit ?? a.name}>
          {a.name}
        </span>
        {a.kind === "video" && <span className="text-muted-foreground">{fmtDur(a.duration)}</span>}
      </div>
      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
        {(!a.kind || a.kind === "image") && (
          <button className="rounded bg-black/60 p-1 text-white hover:bg-black/80" title={a.joints ? "Edit character joints" : "Make this picture a character that can walk"} onClick={onPuppet}>
            <PersonStanding className="size-3.5" />
          </button>
        )}
        <button className="rounded bg-black/60 p-1 text-white hover:bg-black/80" title="Add to canvas" onClick={() => placeAsset(a)}>
          <Plus className="size-3.5" />
        </button>
        <button
          className="rounded bg-black/60 p-1 text-white hover:bg-destructive"
          title="Remove from library"
          onClick={() => {
            const s = useStore.getState();
            const used = s.scene.objects.some((o) => ("asset" in o && o.asset === a.id) || (o.type === "svg" && o.src === `asset:${a.id}`));
            if (used && !confirm(`"${a.name}" is used in the video. Remove it from the library anyway?`)) return;
            s.removeAsset(a.id);
          }}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function SoundItem({ a }: { a: Asset }) {
  return (
    <button className="flex items-center gap-2 rounded-lg border border-line bg-panel-sunken px-2.5 py-2 text-left text-xs hover:border-primary/60" onClick={() => placeAsset(a)} title="Add at the playhead">
      <AudioLines className="size-4 shrink-0 text-clip-voice" />
      <span className="min-w-0 flex-1 truncate">{a.name}</span>
      <span className="text-muted-foreground">{fmtDur(a.duration)}</span>
    </button>
  );
}
