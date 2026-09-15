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

export const FONTS = ["sans", "serif", "hand", "chalk", "mono"] as const;
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

/** x,y is the top of the text at its alignment point. */
export interface TextObj extends BaseObj {
  type: "text";
  text: string;
  size: number;
  color: string;
  font: FontName;
  align: Align;
  bold: boolean;
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
export interface ImageObj extends BaseObj {
  type: "image";
  asset: string;
  w: number;
  h: number;
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

export type SceneObj = StickmanObj | DrawingObj | TextObj | BubbleObj | ImageObj | CreatureObj | EffectObj | SoundObj | LightObj;
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
}

/** Imported pictures and generated voice audio. Kept outside the scene so undo history stays small. */
export interface Asset {
  id: string;
  name: string;
  src: string;
  w: number;
  h: number;
  kind?: "image" | "audio";
  /** Seconds, for audio. */
  duration?: number;
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
