"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PLANS, formatPrice } from "@/lib/plans";
import type { PublicUser } from "@/lib/auth";

export default function AccountPanel() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [justPaid, setJustPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const paid = new URLSearchParams(window.location.search).get("checkout") === "success";
    let tries = 0;
    const load = async () => {
      const res = await fetch("/api/me");
      if (res.status === 401) return router.push("/signin?next=/account");
      const data = await res.json();
      setUser(data.user);
      setJustPaid(paid);
      // Stripe's confirmation can land a few seconds after the redirect; keep checking briefly.
      if (paid && data.user.plan === "free" && tries++ < 10) setTimeout(load, 2000);
    };
    load();
  }, [router]);

  async function openPortal() {
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (data.url) window.location.assign(data.url);
    else setError(data.error ?? "Couldn't open billing.");
  }

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/");
  }

  if (!user) return <p className="py-24 text-center text-muted">Loading your account…</p>;
  const plan = PLANS[user.plan];
  const pct = Math.min(100, Math.round((user.usedToday / user.dailyLimit) * 100));

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold">Your account</h1>
      <p className="mt-1 text-muted">
        {user.name} · {user.email}
      </p>

      {justPaid && (
        <p className="mt-6 rounded-xl border border-capella/40 bg-capella/10 p-4 text-sm">
          {user.plan === "free"
            ? "Payment received. Activating your plan…"
            : `Thanks for subscribing. ${plan.name} is active.`}
        </p>
      )}

      <section className="mt-8 rounded-2xl border border-border bg-surface/80 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Current plan</p>
            <p className="mt-1 text-2xl font-semibold">{plan.name}</p>
            <p className="text-sm text-muted">{formatPrice(plan.priceCents)} / month</p>
            {user.subscriptionStatus === "past_due" && (
              <p className="mt-2 text-sm text-antares">Your last payment failed. Update your card to keep your plan.</p>
            )}
          </div>
          {user.plan === "free" ? (
            <Link href="/pricing" className="rounded-full bg-capella px-4 py-2 text-sm font-medium text-background">
              Upgrade
            </Link>
          ) : (
            <button onClick={openPortal} className="rounded-full border border-border px-4 py-2 text-sm hover:bg-surface-2">
              Manage billing
            </button>
          )}
        </div>
        <div className="mt-6">
          <div className="flex justify-between text-sm">
            <span>Messages today</span>
            <span className="text-muted">
              {user.usedToday} of {user.dailyLimit.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-surface-2">
            <div className="h-2 rounded-full bg-capella" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {user.hasBilling && user.plan === "free" && (
          <button onClick={openPortal} className="mt-6 text-sm text-muted underline">
            View past invoices
          </button>
        )}
        {error && <p className="mt-3 text-sm text-antares">{error}</p>}
      </section>

      <div className="mt-8 flex gap-3">
        <Link href="/chat" className="rounded-full bg-surface-2 px-5 py-2 text-sm">
          Back to Antares
        </Link>
        <button onClick={signOut} className="rounded-full border border-border px-5 py-2 text-sm hover:bg-surface-2">
          Sign out
        </button>
      </div>
    </main>
  );
}
