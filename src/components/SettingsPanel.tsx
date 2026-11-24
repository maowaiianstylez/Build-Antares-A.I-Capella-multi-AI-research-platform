"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PLANS } from "@/lib/plans";
import type { PublicUser } from "@/lib/auth";
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences, type Preferences } from "@/lib/preferences";
import { speakableText } from "@/components/useVoice";
import { Toggle } from "@/components/Toggle";

type Provider = { id: string; name: string; company: string; region: string };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface/80 px-6 py-4">
      <h2 className="pb-1 text-xs uppercase tracking-wider text-muted">{title}</h2>
      <div className="divide-y divide-border/60">{children}</div>
    </section>
  );
}

export default function SettingsPanel() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me");
      if (res.status === 401) return router.push("/signin?next=/settings");
      const data = await res.json();
      setUser(data.user);
      setProviders(data.providers ?? []);
      setPrefs(loadPreferences());
    })();
  }, [router]);

  function update(patch: Partial<Preferences>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePreferences(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function testVoice(rate: number) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(speakableText("Hi, I'm Rehua. This is how fast I'll read answers to you."));
    u.rate = rate;
    window.speechSynthesis.speak(u);
  }

  async function exportConversations() {
    setExporting(true);
    try {
      const { conversations } = await fetch("/api/conversations").then((r) => r.json());
      const full = await Promise.all(
        (conversations as { id: string }[]).map((c) =>
          fetch(`/api/conversations/${c.id}`)
            .then((r) => r.json())
            .then((d) => d.conversation),
        ),
      );
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), conversations: full }, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `rehua-conversations-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(false);
    }
  }

  if (!user) return <p className="py-24 text-center text-muted">Loading your settings…</p>;
  const plan = PLANS[user.plan];
  const visibleModels = providers.filter((p) => !prefs.disabledModels.includes(p.id));

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold">Settings</h1>
        <span className={`text-xs text-capella transition-opacity ${saved ? "opacity-100" : "opacity-0"}`}>Saved</span>
      </div>
      <p className="mt-1 text-sm text-muted">Changes save right away and apply to this device.</p>

      <Section title="Profile">
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="min-w-0">
            <span className="block truncate text-sm">{user.name}</span>
            <span className="block truncate text-xs text-muted">{user.email}</span>
          </span>
          <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs">{plan.name} plan</span>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-sm text-muted">Billing, usage, and sign out</span>
          <Link href="/account" className="text-sm text-capella hover:underline">
            Open Account
          </Link>
        </div>
      </Section>

      <Section title="Chat">
        <div className="flex items-start justify-between gap-4 py-3">
          <span className="min-w-0">
            <span className="block text-sm">Default AI model</span>
            <span className="mt-0.5 block text-xs text-muted">
              Used for every new message unless you pick another one in the chat.
            </span>
          </span>
          <select
            value={visibleModels.some((p) => p.id === prefs.defaultModel) ? prefs.defaultModel : "auto"}
            onChange={(e) => update({ defaultModel: e.target.value })}
            aria-label="Default AI model"
            className="shrink-0 rounded-full border border-border bg-surface px-3 py-1 text-sm outline-none"
          >
            <option value="auto">Rehua Auto (picks for you)</option>
            {visibleModels.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <Toggle
          label="Start with Deep Dive on"
          hint={
            plan.research
              ? "Every question is cross-checked by all connected AI models, with sources. Uses 5 messages each."
              : "Deep Dive is part of Pro and Max."
          }
          checked={plan.research && prefs.deepDiveDefault}
          disabled={!plan.research}
          onChange={(v) => update({ deepDiveDefault: v })}
        />
        <Toggle
          label="Press Enter to send"
          hint="When off, Enter starts a new line and you send with the button."
          checked={prefs.enterToSend}
          onChange={(v) => update({ enterToSend: v })}
        />
      </Section>

      <Section title="Voice">
        <Toggle
          label="Read answers aloud"
          hint="Rehua speaks each answer as soon as it finishes."
          checked={prefs.readAloud}
          onChange={(v) => update({ readAloud: v })}
        />
        <div className="py-3">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="voice-rate" className="text-sm">
              Speaking speed
            </label>
            <span className="text-xs text-muted">{prefs.voiceRate.toFixed(2)}×</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input
              id="voice-rate"
              type="range"
              min={0.75}
              max={1.5}
              step={0.05}
              value={prefs.voiceRate}
              onChange={(e) => update({ voiceRate: Number(e.target.value) })}
              className="flex-1 accent-[var(--capella)]"
            />
            <button
              type="button"
              onClick={() => testVoice(prefs.voiceRate)}
              className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface-2"
            >
              ▶ Test
            </button>
          </div>
        </div>
      </Section>

      <Section title="Appearance">
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-sm">Theme</span>
          <span className="flex gap-2 text-xs">
            <span className="rounded-full border border-capella px-2.5 py-0.5 text-capella">Dark</span>
            <span className="rounded-full border border-border px-2.5 py-0.5 text-muted">Light · coming soon</span>
          </span>
        </div>
      </Section>

      <Section title="Your data">
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="min-w-0">
            <span className="block text-sm">Download my conversations</span>
            <span className="mt-0.5 block text-xs text-muted">Saves every conversation as one file you can keep.</span>
          </span>
          <button
            type="button"
            onClick={exportConversations}
            disabled={exporting}
            className="shrink-0 rounded-full border border-border px-3 py-1 text-sm hover:bg-surface-2 disabled:opacity-50"
          >
            {exporting ? "Preparing…" : "Download"}
          </button>
        </div>
      </Section>
    </main>
  );
}
