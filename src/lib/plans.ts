export type PlanId = "free" | "pro" | "max";

export type Plan = {
  id: PlanId;
  name: string;
  priceCents: number;
  tagline: string;
  dailyMessages: number;
  research: boolean;
  features: string[];
};

// Prices and limits live here so the pricing page, checkout, and enforcement can't drift apart.
export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceCents: 0,
    tagline: "Try Antares on every device.",
    dailyMessages: 25,
    research: false,
    features: ["25 messages a day", "Sync across all your devices", "Writing, math and code help"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceCents: 1999,
    tagline: "For everyday power users.",
    dailyMessages: 500,
    research: true,
    features: [
      "500 messages a day",
      "Deep research with cited sources",
      "Sync across all your devices",
      "Priority access during busy times",
    ],
  },
  max: {
    id: "max",
    name: "Max",
    priceCents: 4999,
    tagline: "For professionals and heavy research.",
    dailyMessages: 2000,
    research: true,
    features: [
      "2,000 messages a day",
      "Everything in Pro",
      "Early access to Antares Shield",
      "Early access to video creation",
    ],
  },
};

export const PAID_PLANS = [PLANS.pro, PLANS.max];

export const isPlanId = (v: unknown): v is PlanId => v === "free" || v === "pro" || v === "max";

export const formatPrice = (cents: number) => (cents === 0 ? "$0" : `$${(cents / 100).toFixed(2)}`);
