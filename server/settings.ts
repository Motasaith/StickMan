// Local installation settings. Secret values never appear in API responses.
import "dotenv/config";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { z } from "zod";
import { DATA_DIR } from "./voices/paths";
import { SETTING_FIELDS, type SettingKey, type SettingsStatus } from "../src/lib/settings";
import { TEST_KEYS, testConnection, validServiceUrl } from "./settings-test";

type Values = Partial<Record<SettingKey, string>>;
const schema = z.object(Object.fromEntries(SETTING_FIELDS.map(({ key }) => [key, z.string().trim().max(4096).refine((v) => !/[\r\n\0]/.test(v)).optional()]))).strict();
const file = () => join(DATA_DIR, "settings.json");

function read(): Values {
  try {
    return schema.parse(JSON.parse(readFileSync(file(), "utf8"))) as Values;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error("Could not read saved settings. Check the settings file in the app data folder.");
  }
}

export function setting(key: SettingKey): string {
  return read()[key] ?? process.env[key]?.trim() ?? "";
}

function status(): SettingsStatus {
  const saved = read();
  return Object.fromEntries(SETTING_FIELDS.map(({ key, secret }) => {
    const value = saved[key] ?? process.env[key]?.trim() ?? "";
    return [key, { configured: !!value, ...(!secret ? { value } : {}) }];
  })) as SettingsStatus;
}

export const settingsRoutes = new Hono();
settingsRoutes.use("/api/settings/*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  const url = new URL(c.req.url);
  // This app has no account system. Only its local interface may manage shared keys.
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return c.json({ error: "Open Settings on the computer running Stickman Studio using localhost." }, 403);
  const origin = c.req.header("origin");
  if ((origin && origin !== url.origin) || c.req.header("sec-fetch-site") === "cross-site") return c.json({ error: "Open Settings from Stickman Studio." }, 403);
  await next();
});
settingsRoutes.get("/api/settings", (c) => {
  try { return c.json(status()); }
  catch { return c.json({ error: "Could not load settings. Check the app data folder." }, 500); }
});
settingsRoutes.put("/api/settings", async (c) => {
  if (!c.req.header("content-type")?.startsWith("application/json")) return c.json({ error: "Use JSON to save settings." }, 415);
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Check the settings values and try again." }, 400);
  const values = parsed.data as Values;
  if (values.LLM_BASE_URL && !validServiceUrl(values.LLM_BASE_URL)) return c.json({ error: "AI service address must be an HTTP or HTTPS URL without credentials, query parameters or a fragment." }, 400);
  try {
    const next = { ...read(), ...values };
    mkdirSync(DATA_DIR, { recursive: true });
    const temporary = `${file()}.tmp`;
    writeFileSync(temporary, JSON.stringify(next, null, 2), { mode: 0o600 });
    renameSync(temporary, file());
    return c.json(status());
  } catch { return c.json({ error: "Could not save settings. Check that the app data folder is writable." }, 500); }
});

settingsRoutes.post("/api/settings/test", async (c) => {
  if (!c.req.header("content-type")?.startsWith("application/json")) return c.json({ error: "Use JSON to test settings." }, 415);
  const parsed = z.object({ key: z.enum(TEST_KEYS), values: schema }).strict().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Check the settings values and try again." }, 400);
  try {
    const saved = read();
    const draft = parsed.data.values as Values;
    return c.json(await testConnection(parsed.data.key, (key) => draft[key] ?? saved[key] ?? process.env[key]?.trim() ?? ""));
  } catch { return c.json({ error: "Could not read saved settings. Reload Settings and try again." }, 500); }
});
