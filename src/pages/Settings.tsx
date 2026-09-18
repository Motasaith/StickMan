import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/SiteFooter";
import { SETTING_FIELDS, type SettingKey, type SettingsStatus } from "@/lib/settings";

async function request(values?: Partial<Record<SettingKey, string>>): Promise<SettingsStatus> {
  const response = await fetch("/api/settings", values ? { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Settings could not be loaded.");
  return data;
}

export default function Settings() {
  const [saved, setSaved] = useState<SettingsStatus | null>(null);
  const [draft, setDraft] = useState<Partial<Record<SettingKey, string>>>({});
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState<SettingKey | null>(null);
  const [results, setResults] = useState<Partial<Record<SettingKey, { ok: boolean; message: string }>>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = () => {
    setError("");
    request().then(setSaved).catch((e: Error) => setError(e.message));
  };
  useEffect(() => { document.documentElement.classList.remove("theme-editor"); load(); }, []);
  async function test(key: SettingKey) {
    setTesting(key);
    setResults((old) => { const next = { ...old }; delete next[key]; return next; });
    try {
      const response = await fetch("/api/settings/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, values: draft }), signal: AbortSignal.timeout(35_000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The test could not run. Try again.");
      setResults((old) => ({ ...old, [key]: data }));
    } catch (e) {
      const message = (e as Error).name === "TimeoutError" ? "The test timed out. Try again." : (e as Error).message;
      setResults((old) => ({ ...old, [key]: { ok: false, message } }));
    } finally { setTesting(null); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      setSaved(await request(draft)); setDraft({});
      setMessage("Settings saved. They apply to new requests immediately.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="min-h-full bg-background text-foreground">
    <main className="mx-auto max-w-3xl px-6 py-8">
      <nav className="mb-10 flex items-center justify-between"><Link to="/" className="text-sm hover:text-primary">Back to home</Link><span className="text-sm font-semibold">Settings</span></nav>
      <h1 className="font-display text-4xl font-bold">Connect your services</h1>
      <p className="mt-3 text-muted-foreground">Paste the keys from your provider accounts here. You do not need to edit files or restart the app.</p>
      <p className="mt-3 text-sm text-muted-foreground">Keys are saved in a file on the computer running Stickman Studio and used by this installation. They are not stored in your browser. Saved keys are hidden; leave their fields blank to keep them, or choose Remove to disable them.</p>
      <p className="mt-3 text-sm text-muted-foreground">Test checks the values currently entered, using the saved key when its field is blank. Testing does not save changes. The AI test sends a short request to your selected model; tests may use provider credit or quota.</p>
      {error && <p role="alert" className="my-4 text-destructive">{error}</p>}
      {!saved ? <div className="my-8">{error ? <Button onClick={load}>Try again</Button> : <p role="status">Loading settings...</p>}</div> : <form onSubmit={save} className="mt-8 space-y-6">
        <fieldset disabled={busy || !!testing} className="space-y-6">
          {SETTING_FIELDS.map((field, index) => <div key={field.key}>
            {(index === 0 || index === 4) && <h2 className="mb-5 border-b border-line pb-2 text-xl font-semibold">{index === 0 ? "AI writing and editing" : "Optional media services"}</h2>}
            <div className="flex items-center justify-between gap-2"><label htmlFor={field.key} className="font-medium">{field.label}</label><span className="text-xs text-muted-foreground">{draft[field.key] === "" && field.secret ? "Will be removed" : saved[field.key].configured ? "Configured" : "Not configured"}</span></div>
            <div className="mt-2 flex gap-2">
              <input id={field.key} type={field.secret ? "password" : "text"} autoComplete="off" spellCheck={false} value={draft[field.key] ?? (field.secret ? "" : saved[field.key].value ?? "")} placeholder={field.secret && saved[field.key].configured ? "Saved key (hidden)" : field.placeholder} aria-describedby={`${field.key}-help`} onChange={(event) => {
                const value = event.target.value;
                setDraft((old) => { const next = { ...old }; if (field.secret && !value) delete next[field.key]; else next[field.key] = value; return next; });
                setMessage(""); setResults({});
              }} className="h-11 min-w-0 flex-1 rounded-md border border-line bg-background px-3 outline-none focus:border-primary" />
              {field.secret && <Button type="button" variant="outline" onClick={() => { setDraft((old) => ({ ...old, [field.key]: "" })); setMessage(""); setResults({}); }}>Remove</Button>}
            </div>
            <p id={`${field.key}-help`} className="mt-1 text-sm text-muted-foreground">{field.help}</p>
            {field.secret && <div className="mt-2 space-y-2">
              <Button type="button" variant="outline" data-test-key={field.key} aria-label={`Test ${field.label}`} onClick={() => void test(field.key)}>{testing === field.key ? "Testing..." : "Test connection"}</Button>
              {results[field.key] && <p role={results[field.key]!.ok ? "status" : "alert"} data-test-result={field.key} className={`text-sm ${results[field.key]!.ok ? "text-foreground" : "text-destructive"}`}>{results[field.key]!.ok ? "Success: " : "Test failed: "}{results[field.key]!.message}</p>}
            </div>}
          </div>)}
        </fieldset>
        <div className="flex gap-3"><Button type="submit" disabled={busy || !!testing || !Object.keys(draft).length}>{busy ? "Saving..." : "Save settings"}</Button><Button type="button" variant="outline" disabled={busy || !!testing || !Object.keys(draft).length} onClick={() => { setDraft({}); setMessage(""); setError(""); setResults({}); }}>Discard changes</Button></div>
        {message && <p role="status" className="text-sm">{message}</p>}
      </form>}
    </main>
    <SiteFooter />
  </div>;
}
