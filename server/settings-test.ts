import type { SettingKey } from "../src/lib/settings";

export const TEST_KEYS = ["LLM_API_KEY", "PEXELS_API_KEY", "YOUTUBE_API_KEY", "POLLINATIONS_API_KEY", "HF_TOKEN"] as const;
export type TestKey = typeof TEST_KEYS[number];

export function validServiceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}

/** Only static messages leave this function. Provider responses can contain credentials. */
export async function testConnection(key: TestKey, get: (key: SettingKey) => string): Promise<{ ok: boolean; message: string }> {
  const token = get(key);
  const fail = (message: string) => ({ ok: false, message });
  if (!token && key !== "LLM_API_KEY") return fail("Enter an API key first, or save one before testing.");
  let url: string;
  let init: RequestInit = { headers: { Authorization: `Bearer ${token}` } };
  let message: string;
  switch (key) {
    case "LLM_API_KEY": {
      const base = get("LLM_BASE_URL");
      if (!validServiceUrl(base)) return fail("Enter a valid HTTP or HTTPS AI service address first.");
      url = `${base.replace(/\/+$/, "")}/chat/completions`;
      init = { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ model: get("LLM_MODEL") || "gpt-oss:120b", messages: [{ role: "user", content: "Reply with OK." }], max_tokens: 16 }) };
      message = "Connected. The selected AI model accepted the test request.";
      break;
    }
    case "PEXELS_API_KEY":
      url = "https://api.pexels.com/v1/curated?per_page=1";
      init.headers = { Authorization: token };
      message = "Key accepted. Pexels photo access works.";
      break;
    case "YOUTUBE_API_KEY":
      url = `https://www.googleapis.com/youtube/v3/videos?part=id&chart=mostPopular&maxResults=1&key=${encodeURIComponent(token)}`;
      init.headers = {};
      message = "Key accepted. YouTube Data API access works.";
      break;
    case "POLLINATIONS_API_KEY":
      url = "https://gen.pollinations.ai/account/key";
      message = "Key is active. Image generation and available credit have not been tested.";
      break;
    case "HF_TOKEN":
      url = "https://huggingface.co/api/whoami-v2";
      message = "Token accepted. Image model permissions and inference credit have not been tested.";
      break;
  }
  try {
    const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      // Read only the known YouTube reason code to distinguish quota from permissions.
      const body = await response.json().catch(() => null);
      const reason = body?.error?.errors?.[0]?.reason;
      if (response.status === 429 || ["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"].includes(reason)) return fail("The provider's rate or quota limit was reached. Check your usage and try again later.");
      if (response.status === 401) return fail("The provider rejected the key. Check that it is correct and has not expired.");
      if (response.status === 403) return fail("Access denied. Check the key's permissions, API restrictions, and whether this service is enabled.");
      if (response.status === 402) return fail("The provider requires credit or an active billing plan.");
      if (response.status === 404) return fail("Service or model not found. Check your service address and model name.");
      if (response.status >= 500) return fail("The provider is temporarily unavailable. Try again later.");
      return fail(`The provider rejected the test (HTTP ${response.status}). Check the service address, model, and account settings.`);
    }
    const body = await response.json().catch(() => null);
    const valid = key === "LLM_API_KEY" ? Array.isArray(body?.choices) && body.choices.length > 0
      : key === "PEXELS_API_KEY" ? Array.isArray(body?.photos)
      : key === "YOUTUBE_API_KEY" ? Array.isArray(body?.items)
      : key === "POLLINATIONS_API_KEY" ? body?.valid === true
      : typeof body?.name === "string";
    if (!valid) return fail(key === "POLLINATIONS_API_KEY" && body?.valid === false ? "This key is not active. Replace it with a valid key." : "The service returned an unexpected response. Check the service address and try again.");
    return { ok: true, message };
  } catch (error) {
    return fail((error as Error).name === "TimeoutError" || (error as Error).name === "AbortError"
      ? "The test timed out after 30 seconds. Check your connection or try again when the service is ready."
      : "Could not connect to the provider. Check your connection and service address, and make sure any local AI service is running.");
  }
}
