// The AI writer for faceless videos: fresh angles on a topic, then a full scene-by-scene script
// with narration, stock footage searches and on-screen text.

import { z } from "zod";
import { chat, parseJsonObject } from "../llm";
import { nicheById, WORDS_PER_MINUTE, type Niche } from "../../src/engine/niches";
import type { ScriptScene, VideoScript } from "../../src/engine/footage";
import { groupSentences, sentencesOf } from "../../src/engine/align";

export interface BriefInput {
  niche: string;
  /** Free text: what the video is about. */
  idea: string;
  /** The user's own draft or notes, kept and polished. */
  draft?: string;
  tone?: string;
  minutes: number;
  format: "16:9" | "9:16";
  language?: string;
  audience?: string;
}

export interface Angle {
  title: string;
  hook: string;
  whyFresh: string;
  searchPhrase: string;
}

const BANNED = [
  "in today's video",
  "welcome back",
  "buckle up",
  "delve",
  "tapestry",
  "game-changer",
  "let's dive in",
  "without further ado",
  "in this video we will",
  "smash that like button",
  "little did they know",
  "unlock the secrets",
  "in a world where",
];

function nicheBrief(n: Niche, input: BriefInput): string {
  const lines = [
    `Channel type: ${n.label}. ${n.pitch}`,
    `Story structure that works here: ${n.structure}`,
    `Tone: ${input.tone || n.tone}.`,
  ];
  if (input.audience) lines.push(`Audience: ${input.audience}.`);
  if (input.language && !/^english$/i.test(input.language)) lines.push(`Write every spoken word in ${input.language}. Footage searches stay in English.`);
  return lines.join("\n");
}

const angleSchema = z.object({
  saturated: z.array(z.string()).max(8).catch([]),
  angles: z
    .array(
      z.object({
        title: z.string().min(3).max(120),
        hook: z.string().max(300).catch(""),
        whyFresh: z.string().max(300).catch(""),
        searchPhrase: z.string().max(100).catch(""),
      })
    )
    .min(1)
    .max(8),
});

/** Several takes on the idea, steering away from what YouTube already has plenty of. */
export async function suggestAngles(input: BriefInput): Promise<{ saturated: string[]; angles: Angle[] }> {
  const n = nicheById(input.niche);
  const text = await chat(
    [
      {
        role: "system",
        content: `You are a strategist for faceless YouTube channels. You find angles that stand out instead of repeating what already floods YouTube.
Return ONLY JSON: {"saturated": ["takes on this topic that are already everywhere on YouTube"], "angles": [{"title": "a clickable, honest title under 70 characters", "hook": "the first sentence the narrator says", "whyFresh": "one sentence on why this beats the common takes", "searchPhrase": "3 to 6 words a viewer would type into YouTube search to find this"}]}
Give 5 angles. Titles must be specific and curiosity-driven without being clickbait lies. Prefer an unusual lens: a specific person, a single decision, a number, a comparison, a myth, a what-if, a lesser-known case. No clichés.
Build every angle on things that really happened and are publicly documented. Never invent meetings, votes, secret projects, unnamed insiders, quotes or dates. When you are not sure a detail is true, leave it out or frame the angle as a question.`,
      },
      {
        role: "user",
        content: `${nicheBrief(n, input)}\nLength: about ${input.minutes >= 1 ? `${input.minutes} minutes` : "under 60 seconds (a vertical short)"}.\nThe video idea: ${input.idea || "(no idea given: suggest strong topics for this channel type)"}${input.draft ? `\nThe creator's notes:\n${input.draft.slice(0, 3000)}` : ""}`,
      },
    ],
    { jsonMode: true, temperature: 0.9, reasoning: "medium", timeoutMs: 180_000 }
  );
  const parsed = angleSchema.safeParse(parseJsonObject(text));
  if (!parsed.success) throw new Error("The AI didn't return usable ideas. Try again.");
  return parsed.data;
}

const overlaySchema = z
  .object({
    kind: z.enum(["title", "stat", "quote", "lowerThird", "list"]),
    text: z.string().max(200).catch(""),
    sub: z.string().max(120).optional().catch(undefined),
    value: z.number().finite().optional().catch(undefined),
    prefix: z.string().max(4).optional().catch(undefined),
    suffix: z.string().max(10).optional().catch(undefined),
    items: z.array(z.string().max(60)).max(4).optional().catch(undefined),
  })
  .nullable()
  .optional()
  .catch(null);

const sceneSchema = z.object({
  chapter: z.string().max(60).optional().catch(undefined),
  narration: z.string().min(2).max(1200),
  visuals: z.array(z.string().min(2).max(80)).min(1).max(4).catch(["abstract background"]),
  media: z.enum(["video", "photo"]).optional().catch(undefined),
  overlay: overlaySchema,
});

const scriptSchema = z.object({
  title: z.string().min(2).max(120),
  hook: z.string().max(400).catch(""),
  description: z.string().max(3000).catch(""),
  tags: z.array(z.string().max(40)).max(20).catch([]),
  thumbnailText: z.string().max(60).catch(""),
  scenes: z.array(sceneSchema).min(1).max(120),
  checks: z.array(z.string().max(300)).max(30).catch([]),
});

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

function scriptSystem(input: BriefInput): string {
  const short = input.minutes < 1;
  const words = Math.round(Math.max(0.5, input.minutes) * WORDS_PER_MINUTE);
  return `You write narration scripts for faceless YouTube videos: a voice-over over stock footage, with on-screen text. You write like the best documentary and explainer channels: vivid, specific, rhythmic and honest.

Return ONLY JSON:
{"title": "...", "hook": "the opening line", "description": "2-4 sentence YouTube description", "tags": ["8 to 12 search tags"], "thumbnailText": "3 to 5 punchy words for the thumbnail",
 "scenes": [{"chapter": "chapter name", "narration": "what the narrator says", "visuals": ["stock footage search", "another"], "media": "video" | "photo", "overlay": null | {...}}],
 "checks": ["specific claims the creator should verify before publishing"]}

LENGTH: about ${words} spoken words in total (${short ? "a vertical short under 60 seconds" : `about ${input.minutes} minutes at ${WORDS_PER_MINUTE} words a minute`}). Each scene is ${short ? "8 to 22" : "25 to 60"} words: one idea, one visual beat.
${short ? "No chapters." : "Group scenes into 3 to 6 chapters with short evocative names; every scene carries its chapter name."}

WRITING:
- The first two sentences must hook: a surprising fact, a vivid moment or a question the viewer needs answered. No greeting.
- Vary sentence length. Short sentences at turning points. Concrete nouns and strong verbs over adjectives.
- Use open loops ("but that was only the beginning") to carry attention across chapters, and pay them off.
- Never use these phrases: ${BANNED.map((b) => `"${b}"`).join(", ")}.
- Spoken words only: no stage directions, no brackets, no emojis, no markdown, no speaker labels.
- One natural invitation to subscribe or follow, in the last scene only.

FACTS:
- Use only well-established facts. Never invent statistics, quotes, dates or names. If a number is illustrative, say so ("say you invest...").
- Put every specific claim that could be wrong (figures, dates, quotes, who did what) in "checks".
- Real people and companies: stay factual and fair; no accusations beyond the public record.

VISUALS (Pexels stock search, English): 1 to 3 per scene, most fitting first. Describe filmable, generic subjects: "empty shopping mall at night", "stock market numbers on screen", "hands counting cash". No brand names, logos, famous people or text. "media": "photo" only when a still image fits better; otherwise "video".

ON-SCREEN TEXT ("overlay"): on at most one scene in three, else null:
- {"kind":"title","text":"chapter title"} at the start of a chapter
- {"kind":"stat","text":"what the number means","value":42,"prefix":"$","suffix":"B"} only for a number the narration says
- {"kind":"list","text":"heading","items":["2 to 4 short items"]}
- {"kind":"lowerThird","text":"a name or place","sub":"who or what it is"}
- {"kind":"quote","text":"a real, well-known quote","sub":"who said it"} only if the quote is genuine`;
}

function normalise(raw: z.infer<typeof scriptSchema>, input: BriefInput): VideoScript {
  const scenes: ScriptScene[] = raw.scenes
    .map((s, i) => ({
      id: `s${i + 1}`,
      chapter: input.minutes < 1 ? undefined : s.chapter?.trim() || undefined,
      // Dashes read as pauses; as commas they also caption cleanly.
      narration: s.narration.replace(/\[[^\]]*\]/g, "").replace(/\s*[\u2014\u2013]\s*/g, ", ").replace(/\s+/g, " ").trim(),
      visuals: s.visuals.map((v) => v.trim()).filter(Boolean).slice(0, 3),
      media: s.media,
      // The video gets its own "subscribe" card at the end.
      overlay: s.overlay && /subscribe|follow for/i.test(`${s.overlay.text} ${s.overlay.sub ?? ""}`) ? null : s.overlay && s.overlay.text ? s.overlay : s.overlay?.kind === "list" && s.overlay.items?.length ? s.overlay : null,
    }))
    .filter((s) => s.narration.length > 1);
  return {
    title: raw.title.trim(),
    hook: raw.hook || scenes[0]?.narration.split(/(?<=[.!?])\s/)[0] || "",
    description: raw.description.trim(),
    tags: raw.tags.map((t) => t.trim()).filter(Boolean).slice(0, 15),
    thumbnailText: raw.thumbnailText.trim(),
    niche: input.niche,
    format: input.format,
    scenes,
    checks: raw.checks,
  };
}

/** Write the full script. A draft from the creator is kept and polished rather than replaced. */
export async function writeScript(input: BriefInput & { angle?: { title: string; hook?: string } }): Promise<VideoScript> {
  const n = nicheById(input.niche);
  const target = Math.round(Math.max(0.5, input.minutes) * WORDS_PER_MINUTE);
  const messages = [
    { role: "system" as const, content: scriptSystem(input) },
    {
      role: "user" as const,
      content: [
        nicheBrief(n, input),
        `Footage that suits this channel: ${n.footage}.`,
        `Topic: ${input.idea}`,
        input.angle ? `Angle and title to use: "${input.angle.title}"${input.angle.hook ? `. Planned opening line: "${input.angle.hook}"` : ""}` : "",
        input.draft ? `The creator's draft or notes. Keep their ideas, order and best lines; polish the wording, fill the gaps and complete it:\n"""\n${input.draft.slice(0, 12000)}\n"""` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
  let best: VideoScript | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await chat(messages, { jsonMode: true, temperature: 0.85, reasoning: "medium", timeoutMs: 360_000 });
    const parsed = scriptSchema.safeParse(parseJsonObject(text));
    if (!parsed.success) {
      messages.push({ role: "assistant", content: text.slice(0, 4000) } as never, { role: "user", content: "That wasn't valid JSON in the required shape. Return the complete script as JSON only." } as never);
      continue;
    }
    const script = normalise(parsed.data, input);
    const words = script.scenes.reduce((s, sc) => s + wordCount(sc.narration), 0);
    if (!best || Math.abs(words - target) < Math.abs(best.scenes.reduce((s, sc) => s + wordCount(sc.narration), 0) - target)) best = script;
    // Far too short or long: ask once for a fitting length.
    if (words >= target * 0.75 && words <= target * 1.35) break;
    messages.push(
      { role: "assistant", content: text.slice(0, 20000) } as never,
      { role: "user", content: `That script has ${words} spoken words, but the video needs about ${target}. ${words < target ? "Expand it with more scenes and richer detail, keeping the same story." : "Tighten it, keeping the strongest scenes."} Return the complete script as JSON.` } as never
    );
  }
  if (!best) throw new Error("The AI couldn't write the script. Try again or change the idea a little.");
  return best;
}


const annotation = z.object({
  chapter: z.string().max(60).optional().catch(undefined),
  visuals: z.array(z.string().min(2).max(80)).min(1).max(4).catch(["abstract background"]),
  media: z.enum(["video", "photo"]).optional().catch(undefined),
  overlay: overlaySchema,
});

const splitSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(3000).catch(""),
  tags: z.array(z.string().max(40)).max(20).catch([]),
  thumbnailText: z.string().max(60).catch(""),
  checks: z.array(z.string().max(300)).max(30).catch([]),
  scenes: z.array(annotation.extend({ from: z.number().int(), to: z.number().int() })).min(1),
});

const annotateSchema = z.object({
  title: z.string().min(2).max(120).catch("Untitled video"),
  description: z.string().max(3000).catch(""),
  tags: z.array(z.string().max(40)).max(20).catch([]),
  thumbnailText: z.string().max(60).catch(""),
  checks: z.array(z.string().max(300)).max(30).catch([]),
  scenes: z.array(annotation),
});

const VISUAL_RULES = `VISUALS (Pexels stock search, English): 1 to 3 per scene, most fitting first, concrete and filmable ("empty shopping mall at night", "hands counting cash"). No brand names, logos, famous people or text. "media": "photo" only when a still fits better, else "video".
ON-SCREEN TEXT ("overlay"), on at most one scene in three, else null: {"kind":"title","text":...} at a chapter start; {"kind":"stat","text":"what it means","value":42,"prefix":"$","suffix":"%"} only for a number the scene says; {"kind":"list","text":"heading","items":[2 to 4 short items]}; {"kind":"lowerThird","text":"name","sub":"who it is"}; {"kind":"quote","text":"...","sub":"who"} only for a real quote in the scene.`;

/**
 * The creator's own script, word for word: the AI only groups its sentences into scenes and
 * plans the visuals. If the grouping it returns doesn't cover every sentence in order, the
 * app groups them itself and asks only for visuals.
 */
export async function splitScript(input: BriefInput & { text: string }): Promise<VideoScript> {
  const sentences = sentencesOf(input.text);
  if (!sentences.length) throw new Error("The script is empty.");
  const short = input.minutes < 1;
  const numbered = sentences.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const n = nicheById(input.niche);
  let scenes: ScriptScene[] | null = null;
  let meta: Omit<z.infer<typeof annotateSchema>, "scenes"> | null = null;
  try {
    const text = await chat(
      [
        {
          role: "system",
          content: `You plan the visuals for a creator's finished narration script. You never change their words.
The script is given as numbered sentences. Group consecutive sentences into scenes of ${short ? "8 to 22" : "15 to 45"} words, one idea each, covering every sentence exactly once and in order.${short ? "" : " Give scenes short chapter names (3 to 6 chapters)."}
Return ONLY JSON: {"title": "a clickable, honest title", "description": "2-4 sentence YouTube description", "tags": ["8 to 12 tags"], "thumbnailText": "3 to 5 words", "checks": ["specific claims in the script worth verifying"], "scenes": [{"from": 1, "to": 3, "chapter": "...", "visuals": ["..."], "media": "video", "overlay": null}]}
${VISUAL_RULES}`,
        },
        { role: "user", content: `Channel type: ${n.label}. Footage that suits it: ${n.footage}.\n\nScript:\n${numbered.slice(0, 60000)}` },
      ],
      { jsonMode: true, temperature: 0.5, reasoning: "medium", timeoutMs: 300_000 }
    );
    const parsed = splitSchema.safeParse(parseJsonObject(text));
    if (parsed.success) {
      const groups = parsed.data.scenes;
      // Every sentence once, in order.
      let next = 1;
      const valid = groups.every((g) => {
        const ok = g.from === next && g.to >= g.from && g.to <= sentences.length;
        next = g.to + 1;
        return ok;
      }) && next === sentences.length + 1;
      meta = parsed.data;
      if (valid) {
        scenes = groups.map((g, i) => ({
          id: `s${i + 1}`,
          chapter: short ? undefined : g.chapter?.trim() || undefined,
          narration: sentences.slice(g.from - 1, g.to).join(" "),
          visuals: g.visuals.map((v) => v.trim()).filter(Boolean).slice(0, 3),
          media: g.media,
          overlay: g.overlay && g.overlay.text ? g.overlay : null,
        }));
      }
    }
  } catch {
    // Fall through to the app's own grouping.
  }

  if (!scenes) {
    const groups = groupSentences(sentences, short ? 16 : 30);
    let notes: z.infer<typeof annotateSchema> | null = null;
    try {
      const text = await chat(
        [
          {
            role: "system",
            content: `You plan the visuals for the scenes of a creator's narration script. Keep the scenes exactly as given: one entry per scene, same order.
Return ONLY JSON: {"title": "...", "description": "...", "tags": ["..."], "thumbnailText": "...", "checks": ["..."], "scenes": [{"chapter": "...", "visuals": ["..."], "media": "video", "overlay": null}]}
${VISUAL_RULES}`,
          },
          { role: "user", content: `Channel type: ${n.label}.\n\n${groups.map((g, i) => `Scene ${i + 1}: ${g}`).join("\n")}` },
        ],
        { jsonMode: true, temperature: 0.5, reasoning: "low", timeoutMs: 240_000 }
      );
      const parsed = annotateSchema.safeParse(parseJsonObject(text));
      if (parsed.success) notes = parsed.data;
    } catch {
      notes = null;
    }
    const fallback = n.footage.split(",").map((v) => v.trim()).filter(Boolean);
    scenes = groups.map((g, i) => {
      const a = notes?.scenes[i];
      return {
        id: `s${i + 1}`,
        chapter: short ? undefined : a?.chapter?.trim() || undefined,
        narration: g,
        visuals: a?.visuals.length ? a.visuals.slice(0, 3) : [fallback[i % Math.max(1, fallback.length)] ?? "abstract background"],
        media: a?.media,
        overlay: a?.overlay && a.overlay.text ? a.overlay : null,
      };
    });
    meta = meta ?? notes;
  }

  return {
    title: meta?.title?.trim() || input.idea.slice(0, 80) || sentences[0].slice(0, 80),
    hook: sentences[0],
    description: meta?.description?.trim() ?? "",
    tags: (meta?.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 15),
    thumbnailText: meta?.thumbnailText?.trim() ?? "",
    niche: input.niche,
    format: input.format,
    scenes,
    checks: meta?.checks ?? [],
  };
}

/** Rewrite one scene in context ("make it punchier", "add a number"...). */
export async function rewriteScene(input: { script: Pick<VideoScript, "title" | "niche" | "scenes">; index: number; instruction: string; tone?: string }): Promise<ScriptScene> {
  const n = nicheById(input.script.niche);
  const cur = input.script.scenes[input.index];
  if (!cur) throw new Error("That scene doesn't exist.");
  const around = input.script.scenes
    .slice(Math.max(0, input.index - 2), input.index + 3)
    .map((s, k) => `${k + Math.max(0, input.index - 2) === input.index ? ">>" : "  "} ${s.narration}`)
    .join("\n");
  const text = await chat(
    [
      {
        role: "system",
        content: `You rewrite one scene of a faceless YouTube script. Keep it spoken-word only, factual, vivid and about the same length unless asked otherwise. Never use: ${BANNED.join(", ")}.
Return ONLY JSON: {"narration": "...", "visuals": ["stock footage search"], "media": "video" | "photo", "overlay": null | {"kind": "title" | "stat" | "quote" | "lowerThird" | "list", "text": "...", ...}}`,
      },
      {
        role: "user",
        content: `Video: "${input.script.title}" (${n.label}, tone ${input.tone || n.tone}).\nScenes around it (>> is the one to rewrite):\n${around}\n\nInstruction: ${input.instruction || "Make it more gripping."}`,
      },
    ],
    { jsonMode: true, temperature: 0.8, reasoning: "low", timeoutMs: 120_000 }
  );
  const parsed = sceneSchema.safeParse({ chapter: cur.chapter, ...parseJsonObject(text) });
  if (!parsed.success) throw new Error("The AI's rewrite wasn't usable. Try again.");
  return { ...cur, narration: parsed.data.narration.trim(), visuals: parsed.data.visuals, media: parsed.data.media, overlay: parsed.data.overlay ?? null };
}
