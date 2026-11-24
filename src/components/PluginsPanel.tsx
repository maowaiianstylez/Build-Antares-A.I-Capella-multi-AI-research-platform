"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PLANS } from "@/lib/plans";
import type { PublicUser } from "@/lib/auth";
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences, type Preferences } from "@/lib/preferences";
import InstallButton from "@/components/InstallButton";

type Provider = { id: string; name: string; company: string; region: string };

const COMING_SOON = [
  { icon: "📁", name: "Google Drive & Dropbox", what: "Ask questions about your own documents." },
  { icon: "📧", name: "Email & calendar", what: "Summarize your inbox and plan your week." },
  { icon: "📝", name: "Notion", what: "Search and write to your notes." },
  { icon: "💬", name: "Slack", what: "Catch up on channels and draft replies." },
  { icon: "🏠", name: "Smart home", what: "Talk to Rehua through your home speakers." },
  { icon: "🚗", name: "In your car", what: "Hands-free Rehua on CarPlay and Android Auto." },
];

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-surface/80 p-4">{children}</div>;
}

function Badge({ tone, children }: { tone: "on" | "off" | "soon" | "locked"; children: React.ReactNode }) {
  const styles = {
    on: "border-capella/50 bg-capella/10 text-capella",
    off: "border-border text-muted",
    soon: "border-border text-muted",
    locked: "border-antares/40 text-antares",
  }[tone];
  return <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${styles}`}>{children}</span>;
}

export default function PluginsPanel() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [voiceOk, setVoiceOk] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me");
      if (res.status === 401) return router.push("/signin?next=/plugins");
      const data = await res.json();
      setUser(data.user);
      setProviders(data.providers ?? []);
      setPrefs(loadPreferences());
      setVoiceOk("speechSynthesis" in window);
    })();
  }, [router]);

  function toggleModel(id: string, on: boolean) {
    const disabled = on ? prefs.disabledModels.filter((m) => m !== id) : [...prefs.disabledModels, id];
    const next = { ...prefs, disabledModels: disabled, defaultModel: !on && prefs.defaultModel === id ? "auto" : prefs.defaultModel };
    setPrefs(next);
    savePreferences(next);
  }

  if (!user) return <p className="py-24 text-center text-muted">Loading plugins…</p>;
  const research = PLANS[user.plan].research;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <h1 className="text-3xl font-semibold">Plugins</h1>
      <p className="mt-1 text-sm text-muted">Add-ons that give Rehua more abilities. Turn them on or off any time.</p>

      <h2 className="mt-8 text-xs uppercase tracking-wider text-muted">AI models</h2>
      <p className="mt-1 text-xs text-muted">
        Switching a model off hides it from your model picker on this device. Deep Dive still cross-checks every
        connected model.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {providers.map((p) => {
          const on = !prefs.disabledModels.includes(p.id);
          return (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted">
                    by {p.company}
                    {p.region !== "US" && <span className="text-antares"> · data processed in {p.region}</span>}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${p.name} in model picker`}
                  onClick={() => toggleModel(p.id, !on)}
                  className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors ${on ? "border-capella bg-capella" : "border-border bg-surface-2"}`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4.5 w-4.5 rounded-full transition-transform ${on ? "translate-x-5 bg-background" : "translate-x-0 bg-muted"}`}
                  />
                </button>
              </div>
            </Card>
          );
        })}
        {providers.length === 0 && (
          <Card>
            <p className="text-sm text-muted">No AI models are connected yet. Rehua is running in demo mode.</p>
          </Card>
        )}
      </div>

      <h2 className="mt-10 text-xs uppercase tracking-wider text-muted">Built in</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">🔭 Web research</p>
            {research ? <Badge tone="on">On</Badge> : <Badge tone="locked">Pro & Max</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted">Deep Dive searches the web and cites its sources.</p>
          {!research && (
            <Link href="/pricing" className="mt-2 inline-block text-xs text-capella hover:underline">
              See plans
            </Link>
          )}
        </Card>
        <Card>
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">🎙 Voice</p>
            {voiceOk ? <Badge tone="on">On</Badge> : <Badge tone="off">Not in this browser</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted">Speak your questions and hear answers read aloud.</p>
          <Link href="/settings" className="mt-2 inline-block text-xs text-capella hover:underline">
            Voice settings
          </Link>
        </Card>
        <Card>
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">🔗 Device sync</p>
            <Badge tone="on">On</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">Start on one device, pick up on another, live.</p>
        </Card>
        <Card>
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">📲 Rehua app</p>
            <Badge tone="off">Optional</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">Put Rehua on your home screen or desktop like a regular app.</p>
          <InstallButton className="mt-2" />
        </Card>
      </div>

      <h2 className="mt-10 text-xs uppercase tracking-wider text-muted">Coming soon</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {COMING_SOON.map((c) => (
          <Card key={c.name}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">
                {c.icon} {c.name}
              </p>
              <Badge tone="soon">Coming soon</Badge>
            </div>
            <p className="mt-1 text-xs text-muted">{c.what}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
