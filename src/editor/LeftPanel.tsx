import { Box, Clapperboard, Globe2, Mic, Music, PawPrint, Presentation, Shapes, Smile, Sparkles, Type, Wand2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useStore, type LeftTab } from "@/store";
import { MediaTab } from "./left/MediaTab";
import { StockTab } from "./left/StockTab";
import { TextTab } from "./left/TextTab";
import { StickersTab } from "./left/StickersTab";
import { IllustrationsTab } from "./left/IllustrationsTab";
import { ShapesTab } from "./left/ShapesTab";
import { CharactersTab } from "./left/CharactersTab";
import { PropsTab } from "./left/PropsTab";
import { EffectsTab } from "./left/EffectsTab";
import { SoundsTab } from "./left/SoundsTab";
import { SlidesTab } from "./left/SlidesTab";
import { RecordTab } from "./left/RecordTab";

const TABS: { id: LeftTab; label: string; icon: typeof Box }[] = [
  { id: "media", label: "Media", icon: Clapperboard },
  { id: "stock", label: "Stock", icon: Globe2 },
  { id: "slides", label: "Slides", icon: Presentation },
  { id: "text", label: "Text", icon: Type },
  { id: "illustrations", label: "Art", icon: Wand2 },
  { id: "stickers", label: "Stickers", icon: Smile },
  { id: "shapes", label: "Shapes", icon: Shapes },
  { id: "characters", label: "People", icon: PawPrint },
  { id: "props", label: "3D", icon: Box },
  { id: "effects", label: "Effects", icon: Sparkles },
  { id: "sounds", label: "Sounds", icon: Music },
  { id: "record", label: "Record", icon: Mic },
];

export function LeftPanel() {
  const tab = useStore((s) => s.leftTab);
  const Panel = {
    media: MediaTab,
    stock: StockTab,
    text: TextTab,
    stickers: StickersTab,
    illustrations: IllustrationsTab,
    shapes: ShapesTab,
    characters: CharactersTab,
    props: PropsTab,
    effects: EffectsTab,
    sounds: SoundsTab,
    slides: SlidesTab,
    record: RecordTab,
  }[tab];
  return (
    <aside className="flex shrink-0 border-r border-line bg-panel">
      <nav className="flex w-[62px] flex-col items-center gap-0.5 overflow-y-auto border-r border-line py-2">
        {TABS.map((t) => (
          <Tooltip key={t.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => useStore.getState().setLeftTab(t.id)}
                className={cn("flex w-[52px] flex-col items-center gap-1 rounded-lg py-2 text-[10px] transition", tab === t.id ? "bg-panel-raised text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
              >
                <t.icon className={cn("size-[18px]", tab === t.id && "text-primary")} />
                {t.label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t.label}</TooltipContent>
          </Tooltip>
        ))}
      </nav>
      <div className="flex w-[292px] min-w-0 flex-col">
        <Panel />
      </div>
    </aside>
  );
}

