// The home page demo: the real editor on a sample project, with a few uses of each tool so
// visitors can try everything without filling the media library.

import { toast } from "sonner";
import { setApiGuard } from "./lib/api";
import { demoGuards, useStore } from "./store";

/** How many times each tool works in the demo. Anything not listed gets DEFAULT_USES. */
export const DEMO_LIMITS: Record<string, number> = {
  ai: 3,
  import: 3,
  aiImage: 1,
  illustrate: 1,
  export: 1,
  short: 1,
  transcribe: 1,
  upload: 0,
};
const DEFAULT_USES = 3;

const LABELS: Record<string, string> = {
  ai: "AI Director requests",
  import: "stock imports",
  aiImage: "AI pictures",
  illustrate: "AI drawings",
  export: "exports",
  short: "Shorts",
  transcribe: "transcriptions",
  upload: "uploads",
  sticker: "stickers",
  illustration: "illustrations",
  svg: "drawings",
  text: "text boxes",
  heading: "titles",
  effect: "effects",
  audio: "sounds",
  sound: "sound effects",
  character: "characters",
  creature: "characters",
  draw: "shapes",
  image: "pictures",
  video: "clips",
  captions: "caption changes",
  updateSlide: "slide changes",
  intro: "intros",
  outro: "outros",
  grade: "color changes",
  theme: "theme changes",
};

const STORAGE = "stickman-studio.demo-uses";

export const demoLimit = (feature: string) => DEMO_LIMITS[feature] ?? DEFAULT_USES;
export const demoLeft = (feature: string) => Math.max(0, demoLimit(feature) - (useStore.getState().demoUses[feature] ?? 0));

function refuse(feature: string) {
  const limit = demoLimit(feature);
  const what = LABELS[feature] ?? `${feature} edits`;
  toast.info(limit ? `You've used the ${limit} demo ${what}` : `${what[0].toUpperCase()}${what.slice(1)} work in the full editor`, {
    description: "Open this video in the full editor to keep going. Nothing is limited there.",
    action: { label: "Open editor", onClick: () => window.dispatchEvent(new Event("stickman-open-demo")) },
  });
}

/** Say whether a tool may run once more, counting the use. */
function allow(feature: string): boolean {
  if (demoLeft(feature) <= 0) {
    refuse(feature);
    return false;
  }
  useStore.getState().countDemoUse(feature);
  try {
    localStorage.setItem(STORAGE, JSON.stringify(useStore.getState().demoUses));
  } catch {
    /* storage unavailable: the limits last until the page reloads */
  }
  return true;
}

function remembered(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE) ?? "{}") as Record<string, number>;
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

/** Turn the limits on for the demo; returns a function that turns them off again. */
export function installDemoLimits(): () => void {
  useStore.setState({ demoUses: remembered() });
  demoGuards.allow = allow;
  setApiGuard((feature) => {
    if (!useStore.getState().demo) return;
    if (!allow(feature)) throw new Error("This works in the full editor (demo limit).");
  });
  return () => {
    demoGuards.allow = null;
    setApiGuard(null);
  };
}

/** Total uses left across the tools that matter most, for the header badge. */
export function aiUsesLeft() {
  return demoLeft("ai");
}
