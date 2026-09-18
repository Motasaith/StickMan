import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api, assetFromUpload, type MediaItem } from "@/lib/api";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { placeAsset } from "../importFiles";
import { GroupLabel, PanelHeader, SearchBox } from "./common";

const SOURCES = [
  { id: "pexels", label: "Pexels", kinds: ["video", "image"] as const, blurb: "Stock video and photos" },
  { id: "wikimedia", label: "Wikimedia", kinds: ["image"] as const, blurb: "Real photos: people, places, history" },
  { id: "nasa", label: "NASA", kinds: ["image"] as const, blurb: "Space and science imagery" },
  { id: "openverse", label: "Openverse", kinds: ["image"] as const, blurb: "Creative Commons pictures" },
  { id: "ai", label: "AI picture", kinds: [] as const, blurb: "Describe a picture and it is drawn for you" },
];

type SourceId = (typeof SOURCES)[number]["id"];

export function StockTab() {
  const vertical = useStore((s) => s.scene.height > s.scene.width);
  const [source, setSource] = useState<SourceId>("pexels");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"image" | "video">("video");
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [drawn, setDrawn] = useState<Array<{ src: string; id: string }>>([]);
  const meta = SOURCES.find((s) => s.id === source)!;

  useEffect(() => {
    if (source !== "pexels" && source !== "ai") setKind("image");
  }, [source]);
  // The AI tools menu can open a source directly.
  useEffect(() => {
    const pick = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (SOURCES.some((s) => s.id === id)) {
        setSource(id as SourceId);
        setItems(null);
        setNotice(null);
        if (id === "ai") requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-ai-picture]")?.focus());
      }
    };
    window.addEventListener("stickman-stock-source", pick);
    return () => window.removeEventListener("stickman-stock-source", pick);
  }, []);

  const search = async (k = kind, src = source) => {
    if (!q.trim() || src === "ai") return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await api.mediaSearch(src, q.trim(), src === "pexels" ? k : "image", vertical ? "portrait" : "landscape");
      setItems(res.items);
    } catch (err) {
      setNotice((err as Error).message);
      setItems([]);
    } finally {
      setBusy(false);
    }
  };

  const add = async (item: MediaItem) => {
    setImporting(item.id);
    try {
      const up = await api.mediaImport(item, `${q.trim() || "stock"} ${item.kind}`, item.source === "pexels" ? "stock" : item.source);
      const asset = assetFromUpload(up);
      useStore.getState().addAsset(asset);
      placeAsset(asset);
      toast.success(`Added ${asset.name}`, { description: item.credit });
    } catch (err) {
      toast.error("Couldn't import that", { description: (err as Error).message });
    } finally {
      setImporting(null);
    }
  };

  const draw = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      const s = useStore.getState().scene;
      const scale = Math.min(1, 1280 / Math.max(s.width, s.height));
      const up = await api.aiImage(prompt.trim(), Math.round((s.width * scale) / 8) * 8, Math.round((s.height * scale) / 8) * 8);
      const asset = assetFromUpload(up, `AI ${prompt.trim().slice(0, 24)}`);
      useStore.getState().addAsset(asset);
      placeAsset(asset);
      setDrawn((d) => [{ src: up.src, id: up.id }, ...d].slice(0, 12));
      if (up.watermark) setNotice("Free AI pictures carry a small watermark. Add a Hugging Face token or Pollinations API key in Settings to remove it.");
    } catch (err) {
      toast.error("Couldn't draw that", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PanelHeader title="Stock and AI pictures" subtitle={meta.blurb}>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSource(s.id);
                setItems(null);
                setNotice(null);
                if (q.trim() && s.id !== "ai") void search(s.id === "pexels" ? kind : "image", s.id);
              }}
              className={cn("chip", source === s.id && "border-primary text-primary", s.id === "ai" && source !== s.id && "border-primary/40 bg-primary/[0.08] text-primary")}
            >
              {s.id === "ai" && <Sparkles className="size-3" />}
              {s.label}
            </button>
          ))}
        </div>
        {source === "ai" ? (
          <div className="flex flex-col gap-2">
            <textarea data-ai-picture value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="A rainy neon street in Tokyo at night, cinematic" className="field-text h-auto resize-none py-1.5" />
            <button className="chip justify-center" disabled={busy || !prompt.trim()} onClick={draw}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Draw it
            </button>
          </div>
        ) : (
          <>
            <SearchBox value={q} onChange={setQ} placeholder="Search: ocean, office, dentist…" onEnter={() => search()} />
            {source === "pexels" && (
              <div className="mt-2 flex gap-1.5">
                {(["video", "image"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => {
                      setKind(k);
                      if (items) void search(k);
                    }}
                    className={cn("chip", kind === k && "border-primary text-primary")}
                  >
                    {k === "video" ? "Videos" : "Photos"}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </PanelHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {notice && <p className="mb-2 text-xs text-warn">{notice}</p>}
        {source === "ai" ? (
          <>
            {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Drawing… (a few seconds)</p>}
            {drawn.length > 0 && <GroupLabel>Drawn this session</GroupLabel>}
            <div className="grid grid-cols-2 gap-2">
              {drawn.map((d) => (
                <img key={d.id} src={d.src} alt="" className="aspect-video w-full rounded-lg border border-line object-cover" />
              ))}
            </div>
            {!drawn.length && !busy && <p className="text-sm text-muted-foreground">Describe the scene, the style and the light. The picture is added at the playhead, sized to the video.</p>}
          </>
        ) : (
          <>
            {busy && <Loader2 className="mx-auto mt-6 size-5 animate-spin text-muted-foreground" />}
            {!busy && items?.length === 0 && !notice && <p className="text-sm text-muted-foreground">No results. Try other words.</p>}
            {!busy && !items && <p className="text-sm text-muted-foreground">Search for footage or photos to use as backgrounds and b-roll. Credits are kept with each file.</p>}
            <div className="grid grid-cols-2 gap-2">
              {!busy &&
                items?.map((it) => (
                  <button key={it.id} onClick={() => add(it)} disabled={!!importing} className="group relative aspect-video overflow-hidden rounded-lg border border-line bg-panel-sunken" title={`${it.credit}${it.license ? ` (${it.license})` : ""}`}>
                    <img src={it.thumbnail} alt="" className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" referrerPolicy="no-referrer" />
                    {it.duration ? <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 font-mono text-[10px] text-white">{it.duration}s</span> : null}
                    {importing === it.id && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Loader2 className="size-5 animate-spin text-white" />
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
