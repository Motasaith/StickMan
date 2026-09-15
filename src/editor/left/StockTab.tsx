import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, assetFromUpload, type StockItem } from "@/lib/api";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { placeAsset } from "../importFiles";
import { PanelHeader, SearchBox } from "./common";

export function StockTab() {
  const vertical = useStore((s) => s.scene.height > s.scene.width);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"image" | "video">("video");
  const [items, setItems] = useState<StockItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);

  const search = async (k = kind) => {
    if (!q.trim()) return;
    setBusy(true);
    try {
      const res = await api.stockSearch(q.trim(), k, vertical ? "portrait" : "landscape");
      setItems(res.items);
      setConfigured(res.configured);
    } catch (err) {
      toast.error("Stock search failed", { description: (err as Error).message });
      setItems([]);
    } finally {
      setBusy(false);
    }
  };

  const add = async (item: StockItem) => {
    setImporting(item.id);
    try {
      const up = await api.stockImport(item, `${q.trim() || "stock"} ${item.kind}`);
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

  return (
    <>
      <PanelHeader title="Stock" subtitle="Free videos and photos from Pexels, shaped for your video.">
        <SearchBox value={q} onChange={setQ} placeholder="Search: ocean, office, dentist…" onEnter={() => search()} />
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
      </PanelHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {busy && <Loader2 className="mx-auto mt-6 size-5 animate-spin text-muted-foreground" />}
        {!configured && <p className="text-sm text-muted-foreground">Stock needs a free Pexels key: add PEXELS_API_KEY to the .env file.</p>}
        {!busy && items?.length === 0 && configured && <p className="text-sm text-muted-foreground">No results. Try other words.</p>}
        {!busy && !items && <p className="text-sm text-muted-foreground">Search for footage or photos to use as backgrounds and b-roll.</p>}
        <div className="grid grid-cols-2 gap-2">
          {!busy &&
            items?.map((it) => (
              <button key={it.id} onClick={() => add(it)} disabled={!!importing} className="group relative aspect-video overflow-hidden rounded-lg border border-line bg-panel-sunken" title={it.credit}>
                <img src={it.thumbnail} alt="" className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                {it.duration && <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 font-mono text-[10px] text-white">{it.duration}s</span>}
                {importing === it.id && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="size-5 animate-spin text-white" />
                  </span>
                )}
              </button>
            ))}
        </div>
      </div>
    </>
  );
}
