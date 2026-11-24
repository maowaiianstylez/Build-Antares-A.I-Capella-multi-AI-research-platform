"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ShieldResult, ThreatLevel } from "@/lib/shield";
import type { AlertItem } from "@/lib/alerts";

type Tab = "scan" | "alerts" | "breaches";

const TABS: { id: Tab; label: string }[] = [
  { id: "scan", label: "Scan" },
  { id: "alerts", label: "Alerts" },
  { id: "breaches", label: "Breach check" },
];

const FTC_URL = "https://reportfraud.ftc.gov";
const IC3_URL = "https://www.ic3.gov";

export default function ShieldPanel() {
  const [tab, setTab] = useState<Tab>("scan");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => setSignedIn(r.ok))
      .catch(() => setSignedIn(false));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <ShieldIcon className="h-9 w-9 text-capella" />
        <div>
          <h1 className="text-3xl font-semibold">Rehua Shield</h1>
          <p className="text-sm text-muted">Check messages and links for scams, follow official alerts, and see if your email was in a breach.</p>
        </div>
      </div>

      <div role="tablist" aria-label="Shield" className="mt-8 flex gap-1 rounded-full border border-border bg-surface/80 p-1 text-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 whitespace-nowrap rounded-full px-3 py-1.5 transition ${
              tab === t.id ? "bg-capella font-medium text-background" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "scan" && <ScanTab signedIn={signedIn} />}
        {tab === "alerts" && <AlertsTab />}
        {tab === "breaches" && <BreachTab signedIn={signedIn} />}
      </div>

      <p className="mt-10 text-xs leading-relaxed text-muted">
        Shield only looks at what you choose to give it. It never reads your email, texts, or other private messages on its
        own, doesn&apos;t keep what you paste, and never files a report for you. Results are an AI estimate, so use your own
        judgment. Never share passwords or one-time codes with anyone. In an emergency, call 911.
      </p>
    </main>
  );
}

// ---------- Scan ----------

const LEVEL_STYLE: Record<ThreatLevel, { label: string; bars: number; color: string; ring: string }> = {
  low: { label: "Low risk", bars: 1, color: "text-emerald-400", ring: "border-emerald-500/40 bg-emerald-500/5" },
  medium: { label: "Caution", bars: 2, color: "text-capella", ring: "border-capella/50 bg-capella/5" },
  high: { label: "High risk", bars: 3, color: "text-antares", ring: "border-antares/60 bg-antares/5" },
};

const EXAMPLE =
  "USPS: Your package is on hold due to an incomplete address. Update your details within 24 hours or it will be returned: https://usps-redelivery-help.co/track";

function ScanTab({ signedIn }: { signedIn: boolean | null }) {
  const [text, setText] = useState("");
  const [scanned, setScanned] = useState("");
  const [result, setResult] = useState<ShieldResult | null>(null);
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function scan(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return setError({ message: "Paste a message, email, or link first." });
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/shield", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error ?? "The check failed."), { upgrade: data.upgrade });
      setScanned(content);
      setResult(data);
    } catch (err) {
      setError({ message: (err as Error).message, upgrade: (err as { upgrade?: boolean }).upgrade });
    } finally {
      setBusy(false);
    }
  }

  if (signedIn === false) {
    return (
      <SignInCard text="Sign in to scan messages and links. A scan counts as one message toward your daily limit." next="/shield" />
    );
  }

  return (
    <div>
      <form onSubmit={scan} className="rounded-2xl border border-border bg-surface/80 p-4">
        <label htmlFor="suspect" className="sr-only">
          Message, email, or link to check
        </label>
        <textarea
          id="suspect"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          maxLength={8000}
          placeholder="Paste a text, email, or link you're not sure about"
          className="w-full resize-y bg-transparent text-sm outline-none placeholder:text-muted"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setText(EXAMPLE)} className="text-xs text-muted underline hover:text-foreground">
            Try an example
          </button>
          <div className="flex gap-2">
            {text && (
              <button
                type="button"
                onClick={() => {
                  setText("");
                  setResult(null);
                  setError(null);
                }}
                className="rounded-full border border-border px-4 py-1.5 text-sm text-muted hover:bg-surface-2"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-capella px-5 py-1.5 text-sm font-medium text-background hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Checking…" : "Scan"}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <p className="mt-4 text-sm text-antares">
          {error.message}{" "}
          {error.upgrade && (
            <Link href="/pricing" className="underline">
              See plans
            </Link>
          )}
        </p>
      )}

      {result && <ResultCard result={result} content={scanned} />}
    </div>
  );
}

function ResultCard({ result, content }: { result: ShieldResult; content: string }) {
  const s = LEVEL_STYLE[result.level];
  const [showReport, setShowReport] = useState(false);
  const [copied, setCopied] = useState(false);
  const unchecked = result.urls.length > 0 && result.urls.every((u) => !u.checked);
  const summary = reportSummary(content, result);

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section aria-live="polite" className={`mt-6 rounded-2xl border p-5 ${s.ring}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`text-lg font-semibold ${s.color}`}>{s.label}</span>
        <span className="flex gap-1" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <i key={i} className={`h-2 w-6 rounded-full ${i <= s.bars ? "bg-current " + s.color : "bg-surface-2"}`} />
          ))}
        </span>
        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs">{result.type}</span>
      </div>
      {result.verdict && <p className="mt-3">{result.verdict}</p>}

      {result.signs.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-muted">Warning signs</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {result.signs.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      {result.steps.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-muted">What to do</h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
            {result.steps.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
        </div>
      )}

      {result.level !== "low" && (
        <div className="mt-5 rounded-xl border border-border bg-background/60 p-4">
          <p className="text-sm">
            Want to report it? You file the report yourself. Rehua never sends anything to the government for you.
          </p>
          {result.report && <p className="mt-1 text-xs text-muted">{result.report}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <a href={FTC_URL} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border px-3 py-1 hover:bg-surface-2">
              Report to the FTC ↗
            </a>
            <a href={IC3_URL} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border px-3 py-1 hover:bg-surface-2">
              Report to the FBI (IC3) ↗
            </a>
            <button onClick={() => setShowReport((v) => !v)} className="rounded-full border border-border px-3 py-1 hover:bg-surface-2">
              {showReport ? "Hide summary" : "Prepare a summary"}
            </button>
          </div>
          {showReport && (
            <div className="mt-3">
              <p className="text-xs text-muted">Review and edit this before you paste it into a report form.</p>
              <textarea
                readOnly
                value={summary}
                rows={8}
                className="mt-2 w-full rounded-lg border border-border bg-surface p-3 text-xs"
              />
              <button onClick={copy} className="mt-2 rounded-full bg-surface-2 px-4 py-1 text-sm">
                {copied ? "Copied" : "Copy summary"}
              </button>
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-muted">
        {result.engine === "ai"
          ? `Checked by ${result.modelName ?? "AI"} with Rehua's built-in rules.`
          : "Basic check only: the AI check isn't available right now, so this uses Rehua's built-in rules."}
        {unchecked && " Links weren't checked against a threat list."}
      </p>
    </section>
  );
}

/** Plain-text summary for the FTC or IC3 form. Built in the browser and never sent anywhere. */
function reportSummary(content: string, r: ShieldResult) {
  return [
    `What happened: I received the message below. Rehua Shield rated it "${r.type}". ${r.verdict}`.trim(),
    r.signs.length ? `Warning signs: ${r.signs.join("; ")}.` : "",
    r.urls.length ? `Links in the message: ${r.urls.map((u) => u.url).join(", ")}` : "",
    `Message text:\n${content}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---------- Alerts ----------

type Feed = { id: string; label: string; source: string; items: AlertItem[]; error: string | null };

function AlertsTab() {
  const [feeds, setFeeds] = useState<Feed[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/shield/alerts")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setFeeds(d.feeds))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="text-sm text-antares">Alerts couldn&apos;t be loaded. Try again in a moment.</p>;
  if (!feeds) return <p className="text-sm text-muted">Loading alerts…</p>;

  return (
    <div className="space-y-8">
      {feeds.map((f) => (
        <section key={f.id}>
          <h2 className="text-lg font-semibold">{f.label}</h2>
          <p className="text-xs text-muted">From {f.source}</p>
          {f.error && <p className="mt-2 text-sm text-muted">{f.error}</p>}
          <ul className="mt-3 space-y-2">
            {f.items.map((a) => (
              <li key={a.link}>
                <a
                  href={a.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-border bg-surface/80 p-4 hover:border-capella/50"
                >
                  <span className="font-medium">{a.title}</span>
                  {a.summary && <span className="mt-1 block text-sm text-muted">{a.summary}</span>}
                  {a.time && (
                    <span className="mt-2 block text-xs text-muted">
                      {new Date(a.time).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ---------- Breaches ----------

type Breach = { name: string; title: string; domain: string; breachDate: string; dataClasses: string[]; verified: boolean };

function BreachTab({ signedIn }: { signedIn: boolean | null }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ email: string; breaches: Breach[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/shield/breach")
      .then((r) => r.json())
      .then((d) => setAvailable(Boolean(d.available)))
      .catch(() => setAvailable(false));
  }, []);

  async function check() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/shield/breach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "The check failed.");
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface/80 p-5">
        <h2 className="text-lg font-semibold">Is your email in a data breach?</h2>
        {signedIn === false ? (
          <SignInCard text="Sign in to check the email on your Rehua account." next="/shield" bare />
        ) : available === false ? (
          <p className="mt-2 text-sm text-muted">
            Breach checks are coming soon. Until then, you can check your email for free at{" "}
            <a href="https://haveibeenpwned.com" target="_blank" rel="noopener noreferrer" className="underline">
              haveibeenpwned.com
            </a>
            .
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              Shield checks only the email on your Rehua account, and only when you ask. Results come from Have I Been
              Pwned and aren&apos;t saved.
            </p>
            <label className="mt-4 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
              <span>I want Rehua to check my account email against known data breaches.</span>
            </label>
            <button
              onClick={check}
              disabled={!consent || busy || available === null}
              className="mt-4 rounded-full bg-capella px-5 py-1.5 text-sm font-medium text-background disabled:opacity-50"
            >
              {busy ? "Checking…" : "Check my email"}
            </button>
            {error && <p className="mt-3 text-sm text-antares">{error}</p>}
            {result && <BreachList result={result} />}
          </>
        )}
      </section>

      <PasswordCheck />

      <p className="text-xs text-muted">
        Breach data:{" "}
        <a href="https://haveibeenpwned.com" target="_blank" rel="noopener noreferrer" className="underline">
          Have I Been Pwned
        </a>
        .
      </p>
    </div>
  );
}

function BreachList({ result }: { result: { email: string; breaches: Breach[] } }) {
  if (!result.breaches.length) {
    return (
      <p className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
        Good news: {result.email} isn&apos;t in any known breach.
      </p>
    );
  }
  return (
    <div className="mt-4">
      <p className="text-sm">
        <span className="font-medium text-antares">{result.email} appears in {result.breaches.length} known breach{result.breaches.length === 1 ? "" : "es"}.</span>{" "}
        Change the password on those sites, use a different password everywhere, and turn on two-step sign-in.
      </p>
      <ul className="mt-3 space-y-2">
        {result.breaches.map((b) => (
          <li key={b.name} className="rounded-xl border border-border bg-background/60 p-3 text-sm">
            <span className="font-medium">{b.title}</span>
            {b.domain && <span className="text-muted"> · {b.domain}</span>}
            <span className="text-muted"> · {b.breachDate}</span>
            {b.dataClasses.length > 0 && <p className="mt-1 text-xs text-muted">Exposed: {b.dataClasses.join(", ")}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Pwned Passwords check using k-anonymity: the browser hashes the password and sends only the first
 * five characters of the hash to Have I Been Pwned. The password never leaves the device, and Rehua's
 * server never sees it. The range API is free and needs no key.
 */
function PasswordCheck() {
  const [pw, setPw] = useState("");
  const [state, setState] = useState<{ count: number } | { error: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!pw) return;
    setBusy(true);
    setState(null);
    try {
      const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(pw));
      const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
      const res = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, { headers: { "Add-Padding": "true" } });
      if (!res.ok) throw new Error();
      const line = (await res.text()).split("\n").find((l) => l.startsWith(hex.slice(5)));
      setState({ count: line ? Number(line.split(":")[1]) : 0 });
    } catch {
      setState({ error: "The password check didn't answer. Try again in a minute." });
    } finally {
      setPw("");
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface/80 p-5">
      <h2 className="text-lg font-semibold">Has a password been leaked?</h2>
      <p className="mt-2 text-sm text-muted">
        Your password never leaves this device. Rehua sends only a short, scrambled fragment, so no one can learn it.
      </p>
      <form onSubmit={check} className="mt-4 flex gap-2">
        <label htmlFor="pw" className="sr-only">
          Password to check
        </label>
        <input
          id="pw"
          type="password"
          autoComplete="off"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-1.5 text-sm"
          placeholder="Password"
        />
        <button disabled={!pw || busy} className="rounded-full bg-surface-2 px-4 py-1.5 text-sm disabled:opacity-50">
          {busy ? "Checking…" : "Check"}
        </button>
      </form>
      {state && "count" in state && (
        <p className={`mt-3 text-sm ${state.count ? "text-antares" : "text-emerald-400"}`}>
          {state.count
            ? `This password has appeared in ${state.count.toLocaleString()} leaks. Stop using it anywhere you do.`
            : "This password isn't in any known leak. Still, use a different password for every site."}
        </p>
      )}
      {state && "error" in state && <p className="mt-3 text-sm text-antares">{state.error}</p>}
    </section>
  );
}

// ---------- Shared ----------

function SignInCard({ text, next, bare = false }: { text: string; next: string; bare?: boolean }) {
  return (
    <div className={bare ? "mt-2" : "rounded-2xl border border-border bg-surface/80 p-6 text-center"}>
      <p className="text-sm text-muted">{text}</p>
      <div className={`mt-4 flex gap-2 ${bare ? "" : "justify-center"}`}>
        <Link href={`/signin?next=${encodeURIComponent(next)}`} className="rounded-full bg-capella px-5 py-1.5 text-sm font-medium text-background">
          Sign in
        </Link>
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="rounded-full border border-border px-5 py-1.5 text-sm">
          Create an account
        </Link>
      </div>
    </div>
  );
}

export function ShieldIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" className={className} aria-hidden="true">
      <path d="M9 2l6 2.5v4c0 3.6-2.6 6.3-6 7.5-3.4-1.2-6-3.9-6-7.5v-4z" strokeLinejoin="round" />
      <path d="M6.5 9l1.8 1.8L11.8 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
