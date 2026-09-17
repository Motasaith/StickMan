// Kinds of faceless YouTube videos the AI video maker writes for: why each one pays off, how
// its scripts are built, and how its edit looks (pacing, grade, captions, titles).

import type { CaptionStyle, FontName, TextStyle, TransitionKind, VoiceId } from "./scene";

export interface NicheStyle {
  /** Typical seconds between cuts. */
  shotSeconds: number;
  /** Color look for the whole video (COLOR_LOOKS id). */
  look: string;
  /** Between chapters. */
  chapterTransition: TransitionKind;
  /** Between scenes inside a chapter. */
  sceneTransition: TransitionKind;
  caption: CaptionStyle;
  headingFont: FontName;
  headingStyle: TextStyle;
  accent: string;
  /** How far photos slowly zoom over a shot (0.08 = 8%). */
  zoom: number;
}

export interface Niche {
  id: string;
  label: string;
  /** Why this kind of video is worth making. */
  pitch: string;
  badges: string[];
  examples: string[];
  /** How the writer should build the story. */
  structure: string;
  tone: string;
  voices: { edge: VoiceId; studio: string };
  /** What the stock footage should look like. */
  footage: string;
  /** How AI pictures for this channel should look. */
  imageStyle: string;
  /** A search for background music that fits. */
  music: string;
  style: NicheStyle;
}

const base: NicheStyle = {
  shotSeconds: 4,
  look: "natural",
  chapterTransition: "fade",
  sceneTransition: "cut",
  caption: "outline",
  headingFont: "poppins",
  headingStyle: "box",
  accent: "#F5B400",
  zoom: 0.08,
};

export const NICHES: Niche[] = [
  {
    id: "finance",
    label: "Personal Finance & Wealth",
    pitch: "Premium advertisers (banks, brokers, fintech) and evergreen search volume around investing, banking breakdowns and case studies.",
    badges: ["Premium ads", "Evergreen search"],
    examples: ["What $100 a month in an index fund really becomes", "How banks make money from your checking account", "The 3 money moves that separate the top 10%"],
    structure: "Hook with a surprising number or a relatable money mistake. Explain the mechanism simply, with one concrete worked example (real arithmetic). Compare options fairly. End with one clear action the viewer can take. Never promise returns; add a short 'this isn't financial advice' line near the end.",
    tone: "clear, confident, practical, no hype",
    voices: { edge: "narrator", studio: "preset:blend_anchor" },
    footage: "city skylines, people working on laptops, coins and cash, stock tickers, banks, calculators, families at home",
    imageStyle: "clean modern editorial photograph, soft daylight, shallow depth of field",
    music: "corporate background music",
    style: { ...base, look: "bright", headingStyle: "highlight", accent: "#16A34A", caption: "karaoke" },
  },
  {
    id: "documentary",
    label: "Mini-Documentaries & Business Scandals",
    pitch: "High average view duration: viewers binge well-researched, dramatic narratives, especially rise-and-fall stories.",
    badges: ["High watch time", "Binge-able"],
    examples: ["The rise and fall of a company that had everything", "The fraud that fooled Wall Street for a decade", "How one decision destroyed a billion-dollar brand"],
    structure: "Cold open on the most dramatic moment, then rewind. Three acts: the rise (who, what made them special), the crack (the first warning signs), the fall (the collapse and its aftermath). Use open loops ('but that wasn't the real problem'), short punchy sentences at turning points, and a closing reflection on the lesson.",
    tone: "cinematic, suspenseful, measured",
    voices: { edge: "narrator", studio: "preset:blend_documentary" },
    footage: "office buildings at night, boardrooms, newspapers, city streets, empty warehouses, courthouses, dramatic skies",
    imageStyle: "cinematic film still, dramatic lighting, moody color grade, 35mm",
    music: "dark cinematic ambient",
    style: { ...base, shotSeconds: 3.6, look: "cinematic", chapterTransition: "fade", caption: "outline", headingFont: "dmserif", headingStyle: "lowerThird", accent: "#DC2626", zoom: 0.1 },
  },
  {
    id: "tech",
    label: "Tech & AI Explained",
    pitch: "Strong rates from software and gadget advertisers, and a curious, fast-growing audience.",
    badges: ["Strong ads", "Growing audience"],
    examples: ["How a chip smaller than a fingernail thinks", "Why your phone battery really dies", "What AI can't do (yet), explained simply"],
    structure: "Open with a question the viewer has wondered about. Build intuition with an everyday analogy before any jargon. Show the mechanism step by step, then one surprising real-world consequence. End with what's coming next.",
    tone: "curious, crisp, friendly",
    voices: { edge: "man", studio: "kokoro:af_kore" },
    footage: "circuit boards, data centers, code on screens, smartphones, robots, futuristic city lights",
    imageStyle: "sleek futuristic photograph, cool blue light, high detail",
    music: "electronic ambient background",
    style: { ...base, shotSeconds: 3.4, look: "cold", chapterTransition: "zoom", headingStyle: "gradient", accent: "#6366F1", caption: "pop" },
  },
  {
    id: "history",
    label: "History & Untold Stories",
    pitch: "Long watch sessions and stories that never get old; works well as a series.",
    badges: ["Evergreen", "Series-friendly"],
    examples: ["The forgotten city that vanished overnight", "The one letter that changed a war", "Why this empire collapsed in a single winter"],
    structure: "Start in the middle of a vivid moment. Set the scene (place, year, stakes). Tell it chronologically with a human at the center. Reveal the lesser-known twist. Tie it to something the viewer knows today.",
    tone: "storytelling, warm, vivid",
    voices: { edge: "oldMan", studio: "preset:blend_storyteller" },
    footage: "old buildings, ruins, maps, candles, libraries, landscapes, historical reenactments",
    imageStyle: "historical scene, painterly cinematic lighting, rich detail, period accurate",
    music: "epic orchestral ambient",
    style: { ...base, shotSeconds: 4.4, look: "vintage", chapterTransition: "fade", headingFont: "dmserif", headingStyle: "shadow", accent: "#B45309", zoom: 0.12 },
  },
  {
    id: "science",
    label: "Science & Space",
    pitch: "A wide audience of all ages, evergreen curiosity and strong thumbnail potential.",
    badges: ["Wide audience", "Evergreen"],
    examples: ["What would happen if the Moon disappeared", "The strangest planet ever found", "How big is the universe, really?"],
    structure: "Start with a mind-bending fact or a what-if. Scale it to human terms with comparisons. Explain the science in three clear steps. Finish with the open question scientists still ask.",
    tone: "awe-struck, clear, playful",
    voices: { edge: "narrator", studio: "kokoro:am_michael" },
    footage: "space, galaxies, earth from orbit, laboratories, oceans, volcanoes, microscopes",
    imageStyle: "awe-inspiring scientific visualization, cinematic lighting, ultra detailed",
    music: "space ambient music",
    style: { ...base, shotSeconds: 4.2, look: "cold", chapterTransition: "zoom", headingStyle: "outline", accent: "#0EA5E9" },
  },
  {
    id: "psychology",
    label: "Psychology & Self-Improvement",
    pitch: "Huge search demand around habits, mindset and relationships, with high engagement and shares.",
    badges: ["High engagement", "Shareable"],
    examples: ["Why you procrastinate (it's not laziness)", "The 2-minute habit that rewires your mornings", "Signs someone is quietly manipulating you"],
    structure: "Name a feeling the viewer recognises. Explain the psychology behind it with one study or principle (described carefully, no invented figures). Give three practical techniques with examples. End on encouragement.",
    tone: "empathetic, calm, encouraging",
    voices: { edge: "woman", studio: "kokoro:af_heart" },
    footage: "people thinking, walking alone, sunrise, journaling, coffee, city crowds, calm nature",
    imageStyle: "warm soft-focus photograph, calm natural light, human emotion",
    music: "calm piano background",
    style: { ...base, shotSeconds: 4.6, look: "bright", chapterTransition: "fade", headingStyle: "highlight", accent: "#EC4899", caption: "karaoke" },
  },
  {
    id: "health",
    label: "Health & Longevity",
    pitch: "Premium health and wellness advertisers. Must stay factual and careful with medical claims.",
    badges: ["Premium ads", "Needs care"],
    examples: ["What happens to your body when you walk every day", "The sleep mistake most adults make", "Foods that quietly drain your energy"],
    structure: "Hook with a common habit. Explain what happens in the body, step by step, in plain words. Separate strong evidence from weak. Give safe, general tips and remind viewers to talk to a doctor for their own situation.",
    tone: "caring, factual, reassuring",
    voices: { edge: "woman", studio: "kokoro:af_aoede" },
    footage: "people exercising, healthy food, doctors, sleeping, running outdoors, water, kitchens",
    imageStyle: "bright clean lifestyle photograph, natural light, healthy and fresh",
    music: "calm acoustic background",
    style: { ...base, look: "bright", headingStyle: "box", accent: "#14B8A6" },
  },
  {
    id: "mysteries",
    label: "Unsolved Mysteries & True Crime",
    pitch: "Some of the highest watch times on YouTube. Real people are involved, so tell it respectfully.",
    badges: ["Very high watch time", "Handle with care"],
    examples: ["The signal from space no one can explain", "The lighthouse keepers who vanished", "The case that still has no answer"],
    structure: "Open on the unexplained moment. Lay out the known facts in order, then the theories one by one with the evidence for and against each. Keep real victims dignified, no gore. End with what remains unknown.",
    tone: "suspenseful, restrained, respectful",
    voices: { edge: "narrator", studio: "kokoro:am_fenrir" },
    footage: "foggy forests, night roads, old houses, flashlights, rain, empty rooms, radio equipment",
    imageStyle: "eerie atmospheric photograph, fog, low light, cinematic suspense",
    music: "dark suspense ambient",
    style: { ...base, shotSeconds: 4, look: "moody", chapterTransition: "fade", headingFont: "bebas", headingStyle: "outline", accent: "#A855F7", zoom: 0.12 },
  },
  {
    id: "geography",
    label: "Geography & How the World Works",
    pitch: "Map-and-data explainers travel well across countries and stay relevant for years.",
    badges: ["Global audience", "Evergreen"],
    examples: ["Why most of this country lives on one tiny strip", "How a single canal moves the world's goods", "The borders that make no sense"],
    structure: "Start with a strange fact about a place. Zoom out: where it is and why it matters. Explain the cause (terrain, climate, history, trade). Add one comparison with a place the viewer knows. End with the bigger picture.",
    tone: "curious, confident, brisk",
    voices: { edge: "man", studio: "kokoro:bm_george" },
    footage: "aerial landscapes, rivers, ports and ships, cities from above, deserts, mountains, maps",
    imageStyle: "sweeping aerial landscape photograph, golden hour, high detail",
    music: "world ambient background",
    style: { ...base, shotSeconds: 3.8, look: "vivid", chapterTransition: "wipe", headingStyle: "box", accent: "#2563EB" },
  },
  {
    id: "luxury",
    label: "Luxury & Billionaire Lifestyles",
    pitch: "Aspirational content with strong advertiser interest from travel, cars and watches.",
    badges: ["Aspirational", "Strong ads"],
    examples: ["Inside the most expensive hotel suite on Earth", "How the ultra-rich actually spend a day", "Why this watch costs more than a house"],
    structure: "Open on the most jaw-dropping detail. Walk through what makes it exceptional, with price comparisons in everyday terms. Reveal the story or craft behind it. End with a thought on value.",
    tone: "polished, smooth, intriguing",
    voices: { edge: "man", studio: "kokoro:bf_emma" },
    footage: "yachts, supercars, luxury hotels, private jets, jewelry, penthouses, fine dining",
    imageStyle: "luxurious high-end editorial photograph, elegant lighting, rich textures",
    music: "lounge jazz background",
    style: { ...base, shotSeconds: 3.8, look: "cinematic", chapterTransition: "fade", headingFont: "abril", headingStyle: "shadow", accent: "#D4AF37" },
  },
  {
    id: "shorts",
    label: "Did-You-Know Shorts",
    pitch: "Fast vertical facts for Shorts, Reels and TikTok: quick reach and new subscribers.",
    badges: ["Fast reach", "Vertical"],
    examples: ["3 facts about octopuses that sound fake", "This everyday object has a secret use", "Why airplane windows are round"],
    structure: "One hook sentence in the first second, then three rapid facts or one fast story, each in one or two short sentences, and a snappy last line that makes people rewatch. Under 60 seconds.",
    tone: "energetic, punchy, playful",
    voices: { edge: "woman", studio: "preset:blend_hype" },
    footage: "close-ups, animals, everyday objects, colorful streets, quick action shots",
    imageStyle: "vivid eye-catching photograph, bold colors, sharp detail",
    music: "upbeat electronic background",
    style: { ...base, shotSeconds: 2.4, look: "vivid", chapterTransition: "zoom", sceneTransition: "cut", caption: "pop", headingFont: "anton", headingStyle: "outline", accent: "#F59E0B", zoom: 0.14 },
  },
];

export const CUSTOM_NICHE: Niche = {
  id: "custom",
  label: "Something else",
  pitch: "Describe your own kind of video; the AI picks the pacing and look.",
  badges: [],
  examples: [],
  structure: "Hook in the first sentence, a clear promise, the story or explanation in a logical order with one surprise, and a satisfying ending.",
  tone: "engaging and clear",
  voices: { edge: "narrator", studio: "kokoro:am_michael" },
  footage: "footage that fits the topic",
  imageStyle: "cinematic photograph, natural light, high detail",
  music: "calm background music",
  style: base,
};

export const nicheById = (id: string | undefined): Niche => NICHES.find((n) => n.id === id) ?? CUSTOM_NICHE;

export const VIDEO_TONES = ["dramatic", "calm and authoritative", "energetic", "conversational", "suspenseful", "inspiring"] as const;

export const VIDEO_LENGTHS = [
  { id: "short", label: "Short (under 60s, vertical)", minutes: 0.8, format: "9:16" as const },
  { id: "3", label: "About 3 minutes", minutes: 3, format: "16:9" as const },
  { id: "5", label: "About 5 minutes", minutes: 5, format: "16:9" as const },
  { id: "8", label: "About 8 minutes", minutes: 8, format: "16:9" as const },
  { id: "12", label: "About 12 minutes", minutes: 12, format: "16:9" as const },
];

/** Narration pace used for length estimates. */
export const WORDS_PER_MINUTE = 150;

/** The intro and outro that suit each kind of channel (see intros.ts). */
export const NICHE_OPENERS: Record<string, { intro: string; outro: string }> = {
  finance: { intro: "minimal", outro: "endscreen" },
  documentary: { intro: "cinematic", outro: "endscreen" },
  tech: { intro: "glitch", outro: "next" },
  history: { intro: "cinematic", outro: "endscreen" },
  science: { intro: "neon", outro: "endscreen" },
  psychology: { intro: "minimal", outro: "thanks" },
  health: { intro: "minimal", outro: "thanks" },
  mysteries: { intro: "cinematic", outro: "next" },
  geography: { intro: "split", outro: "endscreen" },
  luxury: { intro: "cinematic", outro: "thanks" },
  shorts: { intro: "pop", outro: "thanks" },
  custom: { intro: "bold", outro: "endscreen" },
};
