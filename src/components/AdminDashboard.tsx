"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PLANS, formatPrice } from "@/lib/plans";
import type { AdminStats, AdminUserRow } from "@/lib/admin";

const fmtDate = (t: number | null) =>
  t ? new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Never";

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/80 p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}

function Status({ u }: { u: AdminUserRow }) {
  if (u.suspendedAt) return <span className="rounded-full bg-antares/15 px-2 py-0.5 text-xs text-antares">Suspended</span>;
  if (u.subscriptionStatus === "past_due")
    return <span className="rounded-full bg-antares/15 px-2 py-0.5 text-xs text-antares">Past due</span>;
  if (u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing")
    return <span className="rounded-full bg-capella/15 px-2 py-0.5 text-xs text-capella">Paying</span>;
  if (u.subscriptionStatus) return <span className="text-xs text-muted">{u.subscriptionStatus}</span>;
  return <span className="text-xs text-muted">No subscription</span>;
}

export default function AdminDashboard({ adminId }: { adminId: string }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "Couldn't load accounts.");
    setError(null);
    setStats(data.stats);
    setUsers(data.users);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 250);
    return () => clearTimeout(t);
  }, [query, load]);

  async function toggle(u: AdminUserRow) {
    const action = u.suspendedAt ? "unsuspend" : "suspend";
    if (action === "suspend" && !window.confirm(`Suspend ${u.email}? They'll be signed out on every device.`)) return;
    setBusy(u.id);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(data.error ?? "That didn't work.");
    await load(query);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Admin dashboard</h1>
          <p className="mt-1 text-sm text-muted">Accounts, subscriptions and usage across Rehua A.I Capella.</p>
        </div>
        <Link href="/account" className="rounded-full border border-border px-4 py-1.5 text-sm hover:bg-surface-2">
          Back to my account
        </Link>
      </div>

      {stats && (
        <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Accounts" value={stats.totalUsers.toLocaleString()} note={`${stats.newThisWeek} new this week`} />
          <Stat
            label="Paying"
            value={stats.payingUsers.toLocaleString()}
            note={`Pro ${stats.byPlan.pro} · Max ${stats.byPlan.max}${stats.pastDue ? ` · ${stats.pastDue} past due` : ""}`}
          />
          <Stat label="Monthly revenue" value={formatPrice(stats.mrrCents)} note="Active subscriptions" />
          <Stat
            label="Messages today"
            value={stats.messagesToday.toLocaleString()}
            note={`${stats.activeToday} active · ${stats.suspended} suspended`}
          />
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-border bg-surface/80">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="font-medium">Accounts</h2>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            className="w-full rounded-full border border-border bg-background px-4 py-1.5 text-sm outline-none focus:border-capella sm:w-64"
          />
        </div>
        {error && <p className="border-b border-border px-4 py-3 text-sm text-antares">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Today</th>
                <th className="px-4 py-3 font-medium">All time</th>
                <th className="px-4 py-3 font-medium">Last active</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={`border-t border-border/60 ${u.suspendedAt ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {u.name}
                      {u.isAdmin && (
                        <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">Admin</span>
                      )}
                    </p>
                    <p className="text-xs text-muted">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {PLANS[u.plan].name}
                    {u.plan !== u.billedPlan && <span className="block text-xs text-muted">Owner (free)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Status u={u} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {u.usedToday} <span className="text-muted">/ {u.dailyLimit.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {u.messagesSent.toLocaleString()} msgs
                    <span className="block text-xs text-muted">{u.conversations} chats</span>
                  </td>
                  <td className="px-4 py-3 text-muted">{fmtDate(u.lastActiveAt)}</td>
                  <td className="px-4 py-3 text-muted">{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== adminId && !u.isAdmin && (
                      <button
                        onClick={() => toggle(u)}
                        disabled={busy === u.id}
                        className={`rounded-full border px-3 py-1 text-xs disabled:opacity-50 ${
                          u.suspendedAt
                            ? "border-border hover:bg-surface-2"
                            : "border-antares/50 text-antares hover:bg-antares/10"
                        }`}
                      >
                        {busy === u.id ? "…" : u.suspendedAt ? "Unsuspend" : "Suspend"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {stats && users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted">
                    {query ? "No accounts match that search." : "No accounts yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!stats && !error && <p className="py-10 text-center text-muted">Loading…</p>}
      </section>
      <p className="mt-4 text-xs text-muted">
        Suspending signs the account out everywhere and blocks sign-in. It doesn&apos;t cancel a Stripe subscription;
        do that in Stripe if they shouldn&apos;t be billed.
      </p>
    </main>
  );
}
