// Stickman Studio, an AI video studio that runs on your computer.
// Copyright (c) 2026 Abdul Rauf Azhar <https://github.com/Motasaith>
// Source: https://github.com/Motasaith/StickMan
// SPDX-License-Identifier: AGPL-3.0-or-later
// Keep this notice: AGPL-3.0 sections 5(d) and 7(b), see ATTRIBUTION.md.

// The scene is the whole video: plain data the AI and the user both edit.
// The canvas player and the MP4 exporter draw it with the same renderer.

export type Ease = "linear" | "easeIn" | "easeOut" | "easeInOut" | "step";

/** A keyframe. `e` is the easing of the segment that arrives at this key. */
export interface Key {
  t: number;
  v: number;
  e?: Ease;
}

export type Tracks = Record<string, Key[]>;

/** The first five are system fonts; the rest are bundled font files (public/fonts, OFL licensed). */
export const FONTS = [
  "sans", "serif", "hand", "chalk", "mono",
  "roboto", "poppins", "archivo", "anton", "bebas", "righteous", "abril", "dmserif", "pacifico", "lobster", "indie", "marker", "naskh", "nastaliq",
] as const;
export type FontName = (typeof FONTS)[number];
export type Align = "left" | "center" | "right";

export interface Style {
  fill?: string;
  stroke?: string;
  width?: number;
  dash?: number[];
  opacity?: number;
  /** Glows in 3D (lamps, lit windows, screens). */
  glow?: boolean;
  /** Rotation of a solid shape in 3D, degrees around the x, y (vertical) and z axes. */
  rotX?: number;
  rotY?: number;
  rotZ?: number;
}

export type Part = Style &
  (
    | { kind: "rect"; x: number; y: number; w: number; h: number; r?: number }
    | { kind: "circle"; cx: number; cy: number; r: number }
    | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
    | { kind: "line"; x1: number; y1: number; x2: number; y2: number }
    | { kind: "poly"; points: number[]; closed?: boolean }
    | { kind: "path"; d: string }
    | {
        kind: "text";
        x: number;
        y: number;
        text: string;
        size?: number;
        font?: FontName;
        align?: Align;
        bold?: boolean;
      }
    // Solid shapes. In 3D they are real solids; in 2D they are drawn as seen from the front.
    // Like rect, x,y is the top-left of the front (cylinders and cones: cx is the middle, y the top).
    // z is the depth of the shape's middle (+ toward the camera), d its thickness.
    | { kind: "box3"; x: number; y: number; z?: number; w: number; h: number; d: number }
    | { kind: "prism3"; x: number; y: number; z?: number; w: number; h: number; d: number }
    | { kind: "sphere3"; cx: number; cy: number; cz?: number; r: number }
    | { kind: "cylinder3"; cx: number; y: number; z?: number; r: number; h: number }
    | { kind: "cone3"; cx: number; y: number; z?: number; r: number; h: number }
  );

export const JOINTS = [
  "torso",
  "neck",
  "lShoulder",
  "lElbow",
  "rShoulder",
  "rElbow",
  "lHip",
  "lKnee",
  "rHip",
  "rKnee",
  "hipY",
] as const;
export type JointName = (typeof JOINTS)[number];
export type Joints = Record<JointName, number>;

export const EXPRESSIONS = ["none", "happy", "sad", "surprised", "angry", "neutral"] as const;
export type Expression = (typeof EXPRESSIONS)[number];

/**
 * Attachment over time. From `t` on, the object's x, y (and rotation when
 * follow is "full") are relative to the parent's anchor. parent null = free.
 */
export interface Link {
  t: number;
  parent: string | null;
  anchor: string;
  follow: "position" | "full";
}

/** Idle motion that repeats while an object is on screen (computed from time, so export matches). */
export const LOOPS = ["none", "float", "pulse", "wiggle", "spin", "bounce", "shake", "heartbeat", "swing", "breathe", "blink"] as const;
export type LoopKind = (typeof LOOPS)[number];

/** Brightness, contrast, saturation, warmth: -100..100, 0 is unchanged. Blur in pixels. */
export interface ColorAdjust {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  blur?: number;
}

export const COLOR_LOOKS: { id: string; label: string; adjust: ColorAdjust }[] = [
  { id: "natural", label: "Natural", adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 } },
  { id: "vivid", label: "Vivid", adjust: { brightness: 4, contrast: 12, saturation: 35, warmth: 0 } },
  { id: "cinematic", label: "Cinematic", adjust: { brightness: -4, contrast: 18, saturation: -12, warmth: 12 } },
  { id: "moody", label: "Moody", adjust: { brightness: -12, contrast: 22, saturation: -25, warmth: -15 } },
  { id: "bright", label: "Bright and airy", adjust: { brightness: 14, contrast: -8, saturation: 6, warmth: 4 } },
  { id: "vintage", label: "Vintage", adjust: { brightness: 2, contrast: -14, saturation: -30, warmth: 30 } },
  { id: "cold", label: "Cold", adjust: { brightness: 0, contrast: 8, saturation: -10, warmth: -35 } },
  { id: "noir", label: "Black and white", adjust: { brightness: 0, contrast: 25, saturation: -100, warmth: 0 } },
];

/** Green screen: pixels near `color` become see-through. */
export interface ChromaKey {
  color: string;
  similarity: number;
  smoothness: number;
}

/** Shared by pictures and videos: how the media sits in its box. */
export interface MediaLook {
  adjust?: ColorAdjust;
  chroma?: ChromaKey | null;
  shape?: "rect" | "rounded" | "circle";
  /** Part of the source shown, as fractions 0..1 of its width and height. */
  crop?: { x: number; y: number; w: number; h: number } | null;
  flipX?: boolean;
  border?: { width: number; color: string } | null;
  shadow?: boolean;
}

interface BaseObj {
  id: string;
  name: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  opacity: number;
  tracks: Tracks;
  links?: Link[];
  /** The slide this object belongs to (only visible during it). None: on top of every slide. */
  slide?: string;
  loop?: LoopKind;
  /** How strong the loop is (1 = normal). */
  loopAmount?: number;
  /** Locked objects can't be dragged on the canvas. */
  locked?: boolean;
  /** Hidden in the editor and export (an eye toggle on the layer). */
  hidden?: boolean;
  /** "center": rotate and scale around the middle of the content instead of x,y. */
  pivot?: "center";
}

export const LOOK_STYLES = ["stick", "cartoon", "robot", "cutout"] as const;
export type LookStyle = (typeof LOOK_STYLES)[number];
export const HAIRS = ["none", "short", "long", "spiky", "bun", "curly", "ponytail"] as const;
export type Hair = (typeof HAIRS)[number];
export const HATS = ["none", "cap", "tophat", "crown", "beanie", "hardhat", "cowboy", "chef"] as const;
export type Hat = (typeof HATS)[number];

export const CUTOUT_JOINTS = ["head", "neck", "hip", "lElbow", "lHand", "rElbow", "rHand", "lKnee", "lFoot", "rKnee", "rFoot"] as const;
export type CutoutJoint = (typeof CUTOUT_JOINTS)[number];

export interface Look {
  style: LookStyle;
  skin: string;
  shirt: string;
  pants: string;
  shoes: string;
  hair: Hair;
  hairColor: string;
  hat: Hat;
  hatColor: string;
  glasses: boolean;
  beard: boolean;
  dress: boolean;
  /** Picture puppet: where each joint sits on the imported picture, in its pixels. */
  cutout: { asset: string; joints: Record<CutoutJoint, { x: number; y: number }> } | null;
}

export const DEFAULT_LOOK: Look = {
  style: "stick",
  skin: "#f2c9a0",
  shirt: "#3a86ff",
  pants: "#2b2d42",
  shoes: "#222222",
  hair: "short",
  hairColor: "#3b2a20",
  hat: "none",
  hatColor: "#e63946",
  glasses: false,
  beard: false,
  dress: false,
  cutout: null,
};

export const VOICE_IDS = ["man", "woman", "boy", "girl", "oldMan", "oldWoman", "robot", "narrator", "urduMan", "urduWoman", "dog", "cat", "bird"] as const;
export type VoiceId = (typeof VOICE_IDS)[number];

/**
 * A narration voice: one of the Edge voices above, or a studio voice made on this computer:
 * "kokoro:af_heart" (a built-in studio voice), "preset:blend_documentary" (a ready-made blend)
 * or "custom:sv_1a2b" (a blend or clone the user saved).
 */
export type VoiceRef = VoiceId | `${"kokoro" | "preset" | "custom"}:${string}`;
export const LOCAL_VOICE_RE = /^(kokoro|preset|custom):[A-Za-z0-9_-]{1,40}$/;
export const isLocalVoice = (v: string | undefined): boolean => !!v && LOCAL_VOICE_RE.test(v);

/** x,y is the ground point between the feet. */
export interface StickmanObj extends BaseObj {
  type: "stickman";
  color: string;
  lineWidth: number;
  facing: 1 | -1;
  pose: Joints;
  expression: Expression;
  look?: Look;
  voice?: VoiceId;
}

export const SPECIES = ["dog", "cat", "bird", "fish", "custom"] as const;
export type Species = (typeof SPECIES)[number];

/**
 * A bone of a data-driven skeleton. Its joint sits at (x, y) in the parent's space
 * (the parent's origin is its joint, +x runs along it), rotated `angle` degrees
 * (clockwise) from the parent. Parts are drawn in the bone's own space.
 */
export interface BoneDef {
  name: string;
  parent: string | null;
  x: number;
  y: number;
  length: number;
  angle: number;
  parts: Part[];
  /** Draw order; higher is in front. */
  z?: number;
}

/** x,y is the ground point under the creature. Bone tracks are named "b.<bone>". */
export interface CreatureObj extends BaseObj {
  type: "creature";
  species: Species;
  color: string;
  accent: string;
  facing: 1 | -1;
  /** Only for custom creatures; presets are built from the species. */
  rig: BoneDef[] | null;
  voice?: VoiceId;
}

export const EFFECT_KINDS = ["rain", "snow", "confetti", "smoke", "sparkles", "bubbles", "leaves", "fire", "stars", "hearts"] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number];

/** Particles in the area x,y (top-left), w×h. Deterministic in time, so scrubbing and export match. */
export interface EffectObj extends BaseObj {
  type: "effect";
  kind: EffectKind;
  w: number;
  h: number;
  density: number;
  color: string | null;
  seed: number;
}

/** Spoken audio of a bubble: a picture-less asset plus a loudness envelope for lip-sync. */
export interface SpeechAudio {
  asset: string;
  at: number;
  duration: number;
  /** Loudness 0..1, `rate` samples per second. */
  envelope: number[];
  rate: number;
  /** The text and voice it was made from, to notice when it needs redoing. */
  text: string;
  voice: string;
}

/** x,y is the origin of the parts' coordinates. */
export interface DrawingObj extends BaseObj {
  type: "drawing";
  parts: Part[];
  /** Thickness of flat shapes in 3D (default depends on size). */
  depth?: number;
}

export const SOUND_KINDS = [
  "pop",
  "boing",
  "whoosh",
  "thud",
  "ding",
  "click",
  "splash",
  "applause",
  "thunder",
  "magic",
  "bark",
  "meow",
  "tweet",
  "honk",
  "footsteps",
  "drumroll",
  "rain",
  "wind",
] as const;
export type SoundKind = (typeof SOUND_KINDS)[number];

/** A sound effect. It has no picture; it plays from `at` (ambience kinds last `duration`). */
export interface SoundObj extends BaseObj {
  type: "sound";
  kind: SoundKind;
  at: number;
  duration: number;
  volume: number;
}

export const TEXT_STYLES = ["plain", "outline", "shadow", "glow", "box", "highlight", "lowerThird", "gradient"] as const;
export type TextStyle = (typeof TEXT_STYLES)[number];

/** x,y is the top of the text at its alignment point. */
export interface TextObj extends BaseObj {
  type: "text";
  text: string;
  size: number;
  color: string;
  font: FontName;
  align: Align;
  bold: boolean;
  italic?: boolean;
  style?: TextStyle;
  /** Box, highlight and lower-third color; the gradient's second color. */
  accent?: string;
  /** A lower-third's second, smaller line. */
  subtext?: string;
  /** Wrap lines to this width (scene pixels). */
  maxWidth?: number;
  lineHeight?: number;
  letterSpacing?: number;
  /** A number that counts from `from` to `to`; the text is shown as prefix + number + suffix. */
  counter?: { from: number; to: number; start: number; duration: number; decimals: number; prefix: string; suffix: string } | null;
}

export const CHART_KINDS = ["bar", "hbar", "line", "pie", "donut"] as const;
export type ChartKind = (typeof CHART_KINDS)[number];

/** A chart that grows in from `start` over `duration`. x,y is the top-left of its box. */
export interface ChartObj extends BaseObj {
  type: "chart";
  kind: ChartKind;
  data: { label: string; value: number; color?: string }[];
  w: number;
  h: number;
  start: number;
  duration: number;
  colors: string[];
  textColor: string;
  font: FontName;
  unit: string;
  showValues: boolean;
}

/** With a target, x,y offsets the bubble from its default spot above the head. */
export interface BubbleObj extends BaseObj {
  type: "bubble";
  text: string;
  target: string | null;
  size: number;
  thought: boolean;
  /** Voice to speak with (defaults to the speaker's voice); "none" keeps it silent. */
  voice?: VoiceId | "none";
  audio?: SpeechAudio | null;
}

/** x,y is the top-left corner. */
export interface ImageObj extends BaseObj, MediaLook {
  type: "image";
  asset: string;
  w: number;
  h: number;
}

/**
 * An animated SVG: a sticker ("emoji:1f600"), a library illustration ("lib:teeth")
 * or an imported or AI-drawn SVG kept as an asset ("asset:<id>"). x,y is the top-left.
 */
export interface SvgObj extends BaseObj {
  type: "svg";
  src: string;
  w: number;
  h: number;
  /** Scene time at which the SVG's own animation starts. */
  clock: number;
  /** Animation speed (1 = as drawn; 0 freezes it). */
  speed: number;
  /** Exact color swaps to match a theme. */
  colors?: Record<string, string>;
  flipX?: boolean;
}

/** A video clip on the timeline. x,y is the top-left of its box. */
export interface VideoObj extends BaseObj, MediaLook {
  type: "video";
  asset: string;
  w: number;
  h: number;
  /** Timeline second it starts, and how long it plays (after speed). */
  start: number;
  duration: number;
  /** Second of the source file where it starts. */
  in: number;
  speed: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  reverse?: boolean;
  /** Hold the last frame this many extra seconds. */
  freeze?: number;
}

export const AUDIO_ROLES = ["voiceover", "narration", "music", "sound"] as const;
export type AudioRole = (typeof AUDIO_ROLES)[number];

/** Timed words, on the scene clock. */
export interface Word {
  start: number;
  end: number;
  text: string;
}

/** Sound on the timeline: a recording, an upload, a video's detached sound or a spoken narration. */
export interface AudioObj extends BaseObj {
  type: "audio";
  asset: string | null;
  role: AudioRole;
  start: number;
  duration: number;
  in: number;
  speed: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  /** Narration: the words to speak and the voice; the asset is made from them. */
  text?: string;
  voice?: VoiceRef;
  /** Loudness envelope (for waveforms and lip sync), `rate` samples a second. */
  envelope?: number[];
  rate?: number;
  /** When each word is spoken, on the scene clock (for captions). */
  words?: Word[];
  /** A speaker whose mouth moves with it. */
  speaker?: string | null;
}

export const CAPTION_STYLES = ["standard", "outline", "box", "highlight", "karaoke", "pop"] as const;
export type CaptionStyle = (typeof CAPTION_STYLES)[number];

/** Captions: timed words shown a line at a time. */
export interface CaptionObj extends BaseObj {
  type: "caption";
  words: Word[];
  /** The audio or video object the words came from, if any. */
  source: string | null;
  style: CaptionStyle;
  position: "top" | "middle" | "bottom";
  font: FontName;
  size: number;
  color: string;
  accent: string;
  /** Characters per line before breaking. */
  maxChars: number;
}

export const REGION_KINDS = ["blur", "pixelate", "redact", "highlight", "spotlight", "magnify"] as const;
export type RegionKind = (typeof REGION_KINDS)[number];

/** An effect on part of the picture (blur a face, point at a button). x,y is the top-left. */
export interface RegionObj extends BaseObj {
  type: "region";
  kind: RegionKind;
  w: number;
  h: number;
  shape: "rect" | "ellipse";
  strength: number;
  color: string;
}

/** A light in the 3D view (invisible in 2D). x, y, z is where it shines from. */
export interface LightObj extends BaseObj {
  type: "light";
  kind: "point" | "spot";
  color: string;
  intensity: number;
  distance: number;
}

export const LIGHTING_PRESETS = ["day", "golden", "night", "overcast", "studio", "indoor"] as const;
export type LightingPreset = (typeof LIGHTING_PRESETS)[number];

export type SceneObj =
  | StickmanObj
  | DrawingObj
  | TextObj
  | BubbleObj
  | ImageObj
  | CreatureObj
  | EffectObj
  | SoundObj
  | LightObj
  | SvgObj
  | VideoObj
  | AudioObj
  | CaptionObj
  | RegionObj
  | ChartObj;

export const TRANSITIONS = [
  "cut",
  "fade",
  "dipBlack",
  "flash",
  "slideLeft",
  "slideRight",
  "slideUp",
  "slideDown",
  "push",
  "whipLeft",
  "whipRight",
  "zoom",
  "zoomIn",
  "zoomOut",
  "spin",
  "wipe",
  "diagonal",
  "clock",
  "circle",
  "barn",
  "split",
  "blinds",
  "blur",
  "pixelate",
  "glitch",
  "flip",
] as const;
export type TransitionKind = (typeof TRANSITIONS)[number];

export type Background =
  | { kind: "color"; color: string }
  | { kind: "gradient"; from: string; to: string; angle: number; radial?: boolean }
  | { kind: "image"; asset: string; dim?: number };

/** A slide of a presentation: a stretch of the timeline with its own background and objects. */
export interface Slide {
  id: string;
  title: string;
  start: number;
  duration: number;
  background: Background;
  /** How this slide arrives from the previous one. */
  transition: { kind: TransitionKind; duration: number };
  /** Speaker notes (the narration script). */
  notes?: string;
  /** Layout the slide was built with (for the AI and the slide panel). */
  layout?: string;
  /** The content the slide was built from, so a theme change can rebuild it. */
  spec?: unknown;
}

export interface Marker {
  t: number;
  label: string;
  color?: string;
}
export type ObjType = SceneObj["type"];

export interface Scene {
  version: 1;
  width: number;
  height: number;
  fps: number;
  duration: number;
  background: string;
  backgroundImage: string | null;
  /** Where characters stand by default. */
  ground: number;
  camera: { tracks: Tracks };
  objects: SceneObj[];
  /** "3d" shows the same scene as a lit 3D world. */
  mode?: "2d" | "3d";
  /** Floor color in 3D. */
  floor?: string;
  /** 3D lighting and sky. */
  lighting?: LightingPreset;
  /** 3D surface look: "soft" (realistic shading) or "toon" (cel shading with outlines). */
  look3d?: "soft" | "toon";
  /** 3D camera: yaw, pitch, dist, tx, ty, tz, fov tracks. */
  camera3d?: { tracks: Tracks };
  /** A presentation's slides, in time order. */
  slides?: Slide[];
  /** The presentation theme the slides were styled with. */
  theme?: string;
  /** Scene background when it is more than a color. */
  backgroundFill?: Background | null;
  /** Color grade of the whole video. */
  grade?: ColorAdjust | null;
  markers?: Marker[];
  title?: string;
  /** Upload details written with an AI video: what to paste into YouTube, and what to check first. */
  publish?: PublishKit;
}

export interface PublishKit {
  title: string;
  description: string;
  tags: string[];
  thumbnailText: string;
  /** Claims to double-check before publishing. */
  checks: string[];
  /** Footage and voice credits. */
  credits: string[];
  niche?: string;
}

/** Imported pictures and generated voice audio. Kept outside the scene so undo history stays small. */
export interface Asset {
  id: string;
  name: string;
  src: string;
  w: number;
  h: number;
  kind?: "image" | "audio" | "video" | "svg";
  /** Seconds, for audio and video. */
  duration?: number;
  /** An SVG asset's markup (src is empty for these). */
  svg?: string;
  /** Whether a video has a sound track. */
  hasAudio?: boolean;
  /** Where it came from (upload, recording, stock, ai, tts), for credits and the media panel. */
  origin?: string;
  credit?: string;
  /** Timeline previews: a strip of video frames and loudness peaks. */
  filmstrip?: string;
  frames?: number;
  waveform?: number[];
  /** Puppet joints for a character picture, in its pixels. */
  joints?: Record<CutoutJoint, { x: number; y: number }>;
}

export interface Project {
  scene: Scene;
  assets: Asset[];
}

export function emptyScene(width = 1280, height = 720): Scene {
  return {
    version: 1,
    width,
    height,
    fps: 30,
    duration: 8,
    background: "#ffffff",
    backgroundImage: null,
    ground: Math.round(height * 0.86),
    camera: { tracks: {} },
    objects: [],
  };
}

export function findObj(scene: Scene, id: string): SceneObj | undefined {
  return scene.objects.find((o) => o.id === id);
}

export function uniqueId(scene: Scene, base: string): string {
  const clean = base.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "obj";
  if (!findObj(scene, clean)) return clean;
  for (let i = 2; ; i++) if (!findObj(scene, `${clean}${i}`)) return `${clean}${i}`;
}

export function cloneScene(scene: Scene): Scene {
  return structuredClone(scene);
}
