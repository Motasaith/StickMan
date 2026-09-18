// OpenAI-compatible chat client (Ollama Cloud, local Ollama, OpenAI, OpenRouter...).
// Same setup as PromptCut: LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, VISION_LLM_MODEL.

import { setting } from "./settings";

export type ChatContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: ChatContent;
}

export const llmConfig = () => ({
  baseUrl: (setting("LLM_BASE_URL")).replace(/\/+$/, ""),
  apiKey: setting("LLM_API_KEY"),
  model: setting("LLM_MODEL") || "gpt-oss:120b",
  visionModel: setting("VISION_LLM_MODEL") || setting("LLM_MODEL") || "gpt-oss:120b",
});

export async function chat(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; jsonMode?: boolean; timeoutMs?: number; reasoning?: "low" | "medium" | "high" } = {}
): Promise<string> {
  const cfg = llmConfig();
  if (!cfg.baseUrl) throw new Error("The AI is not set up. Open Settings from the homepage and enter your AI service address and API key.");
  const model = opts.model ?? cfg.model;
  const body: Record<string, unknown> = { model, messages, temperature: opts.temperature ?? 0.4 };
  if (opts.jsonMode) body.response_format = { type: "json_object" };
  if (opts.reasoning && /gpt-oss/i.test(model)) body.reasoning_effort = opts.reasoning;

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 240_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

/** Pull a JSON object out of a model reply (code fences, leading prose, etc.). */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const v = JSON.parse(cleaned);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const v = JSON.parse(cleaned.slice(start, end + 1));
        return v && typeof v === "object" && !Array.isArray(v) ? v : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}
