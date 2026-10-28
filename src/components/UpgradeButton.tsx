"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanId } from "@/lib/plans";

export default function UpgradeButton({ plan, label }: { plan: Exclude<PlanId, "free">; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    if (res.status === 401) {
      router.push(`/signup?next=${encodeURIComponent("/pricing")}`);
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      window.location.assign(data.url);
      return;
    }
    setError(data.error ?? "Couldn't start checkout.");
    setBusy(false);
  }

  return (
    <div>
      <button
        onClick={go}
        disabled={busy}
        className="w-full rounded-full bg-capella py-2.5 font-medium text-background hover:brightness-110 disabled:opacity-50"
      >
        {busy ? "Opening checkout…" : label}
      </button>
      {error && <p className="mt-2 text-center text-sm text-antares">{error}</p>}
    </div>
  );
}
