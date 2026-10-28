import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import UpgradeButton from "@/components/UpgradeButton";
import { PLANS, formatPrice } from "@/lib/plans";

export const metadata: Metadata = { title: "Pricing · Antares A.I Capella" };

export default function PricingPage() {
  const plans = [PLANS.free, PLANS.pro, PLANS.max];
  return (
    <div className="starfield min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h1 className="text-center text-4xl font-semibold">Simple plans. Cancel anytime.</h1>
        <p className="mt-3 text-center text-muted">
          Every plan includes sync across your home, phone, tablet, computer, and vehicle.
        </p>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.id}
              className={`flex flex-col rounded-2xl border bg-surface/80 p-6 ${p.id === "pro" ? "border-capella" : "border-border"}`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{p.name}</h2>
                {p.id === "pro" && (
                  <span className="rounded-full bg-capella/15 px-2.5 py-0.5 text-xs text-capella">Most popular</span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted">{p.tagline}</p>
              <p className="mt-5">
                <span className="text-4xl font-semibold">{formatPrice(p.priceCents)}</span>
                <span className="text-muted"> / month</span>
              </p>
              <ul className="mt-6 flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-capella">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {p.id === "free" ? (
                  <Link
                    href="/signup"
                    className="block rounded-full border border-border py-2.5 text-center font-medium hover:bg-surface-2"
                  >
                    Start free
                  </Link>
                ) : (
                  <UpgradeButton plan={p.id} label={`Get ${p.name}`} />
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-xs text-muted">
          Prices in USD. Payments are processed securely by Stripe. Antares never sees your card number.
        </p>
      </main>
    </div>
  );
}
