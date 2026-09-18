import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const state = vi.hoisted(() => ({ dir: "" }));
vi.mock("./voices/paths", () => ({ get DATA_DIR() { return state.dir; } }));
import { setting, settingsRoutes } from "./settings";
import { llmConfig } from "./llm";
import { stockConfigured } from "./stock";
import { youtubeConfigured } from "./autovideo/youtube";
import { aiImagesKeyed } from "./sources";

const directories: string[] = [];
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  state.dir = mkdtempSync(join(process.cwd(), ".settings-test-"));
  directories.push(state.dir);
  vi.stubEnv("PEXELS_API_KEY", "environment-key");
});

const testKey = (key: string, values: Record<string, string> = {}, origin = "http://localhost:5178") => settingsRoutes.request("http://localhost:5178/api/settings/test", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ key, values }),
});

describe("connection tests", () => {
  it("tests a draft without saving it, then can use the hidden saved key", async () => {
    await put({ PEXELS_API_KEY: "saved-secret" });
    const fetcher = vi.fn().mockImplementation(async () => Response.json({ photos: [] }));
    vi.stubGlobal("fetch", fetcher);
    expect((await (await testKey("PEXELS_API_KEY", { PEXELS_API_KEY: "draft-secret" })).json()).ok).toBe(true);
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("draft-secret");
    expect(setting("PEXELS_API_KEY")).toBe("saved-secret");
    await testKey("PEXELS_API_KEY");
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe("saved-secret");
    expect(fetcher.mock.calls[1][1].redirect).toBe("error");
    expect(fetcher.mock.calls[1][1].signal).toBeInstanceOf(AbortSignal);
  });
  it.each([
    ["LLM_API_KEY", { choices: [{ message: { content: "OK" } }] }],
    ["YOUTUBE_API_KEY", { items: [] }],
    ["POLLINATIONS_API_KEY", { valid: true }],
    ["HF_TOKEN", { name: "test-user" }],
  ])("validates the %s provider response", async (key, body) => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(body));
    vi.stubGlobal("fetch", fetcher);
    const response = await testKey(key as string, { [key as string]: "draft-secret", LLM_BASE_URL: "https://provider.example/v1", LLM_MODEL: "my-model" });
    expect((await response.json()).ok).toBe(true);
    if (key === "LLM_API_KEY") expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ model: "my-model", max_tokens: 16 });
  });
  it("protects the test route and rejects malformed or missing inputs before contacting providers", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect((await testKey("PEXELS_API_KEY", {}, "https://other.example")).status).toBe(403);
    expect((await settingsRoutes.request("https://remote.example/api/settings/test", { method: "POST" })).status).toBe(403);
    expect((await testKey("UNKNOWN")).status).toBe(400);
    expect((await testKey("PEXELS_API_KEY", { PEXELS_API_KEY: "bad\nkey" })).status).toBe(400);
    expect((await (await testKey("PEXELS_API_KEY", { PEXELS_API_KEY: "" })).json()).ok).toBe(false);
    expect((await (await testKey("LLM_API_KEY", { LLM_BASE_URL: "file:///private" })).json()).ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([[401, "rejected"], [403, "Access denied"], [429, "quota"], [402, "credit"], [404, "not found"], [503, "unavailable"]])("explains HTTP %s without leaking provider response content", async (status, text) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "secret-token echoed by provider" }, { status: status as number })));
    const response = await testKey("PEXELS_API_KEY");
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.message).toContain(text);
    expect(JSON.stringify(body)).not.toContain("secret-token");
  });
  it("distinguishes a YouTube quota error from an invalid key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { errors: [{ reason: "quotaExceeded" }] } }, { status: 403 })));
    expect((await (await testKey("YOUTUBE_API_KEY", { YOUTUBE_API_KEY: "test" })).json()).message).toContain("quota");
  });
  it("handles timeouts, network errors, invalid keys and unexpected successful responses", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    fetcher.mockRejectedValueOnce(new DOMException("secret-token", "TimeoutError"));
    expect((await (await testKey("PEXELS_API_KEY")).json()).message).toContain("timed out");
    fetcher.mockRejectedValueOnce(new Error("secret-token"));
    expect((await (await testKey("PEXELS_API_KEY")).json()).message).toContain("Could not connect");
    fetcher.mockResolvedValueOnce(Response.json({ valid: false }));
    expect((await (await testKey("POLLINATIONS_API_KEY", { POLLINATIONS_API_KEY: "invalid" })).json()).ok).toBe(false);
    fetcher.mockResolvedValueOnce(new Response("<html>Sign in</html>"));
    expect((await (await testKey("PEXELS_API_KEY")).json()).ok).toBe(false);
  });
});
afterAll(() => {
  vi.unstubAllEnvs();
  for (const dir of directories) {
    if (!resolve(dir).startsWith(resolve(process.cwd()) + "/") && !resolve(dir).startsWith(resolve(process.cwd()) + "\\")) throw new Error("Unexpected test directory");
    rmSync(dir, { recursive: true });
  }
});
const put = (values: unknown, origin = "http://localhost:5178") => settingsRoutes.request("http://localhost:5178/api/settings", {
  method: "PUT", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(values),
});

describe("local settings", () => {
  it("persists secrets without disclosing them and applies provider configuration immediately", async () => {
    const response = await put({ LLM_BASE_URL: "http://localhost:11434/v1", LLM_API_KEY: "secret-ai", LLM_MODEL: "test-model", PEXELS_API_KEY: "secret-stock", YOUTUBE_API_KEY: "secret-youtube", HF_TOKEN: "secret-images" });
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("secret-");
    expect(llmConfig()).toMatchObject({ apiKey: "secret-ai", model: "test-model" });
    expect(stockConfigured()).toBe(true);
    expect(youtubeConfigured()).toBe(true);
    expect(aiImagesKeyed()).toBe(true);
    expect(setting("PEXELS_API_KEY")).toBe("secret-stock");
    const get = await settingsRoutes.request("http://localhost:5178/api/settings");
    expect(get.headers.get("Cache-Control")).toBe("no-store");
    expect(await get.text()).not.toContain("secret-");
  });
  it("preserves unchanged keys and allows removing an environment-provided key", async () => {
    expect(setting("PEXELS_API_KEY")).toBe("environment-key");
    await put({ LLM_API_KEY: "keep-me" });
    await put({ LLM_MODEL: "another-model", PEXELS_API_KEY: "" });
    expect(setting("LLM_API_KEY")).toBe("keep-me");
    expect(stockConfigured()).toBe(false);
  });
  it("rejects foreign origins, remote hosts and invalid values without modifying configuration", async () => {
    expect((await put({ PEXELS_API_KEY: "bad" }, "https://other.example")).status).toBe(403);
    expect((await settingsRoutes.request("https://remote.example/api/settings")).status).toBe(403);
    for (const values of [{ UNKNOWN_KEY: "value" }, { LLM_BASE_URL: "file:///private" }, { LLM_BASE_URL: "https://user:pass@example.com" }, { HF_TOKEN: "line\nbreak" }]) expect((await put(values)).status).toBe(400);
    expect(setting("PEXELS_API_KEY")).toBe("environment-key");
  });
});
