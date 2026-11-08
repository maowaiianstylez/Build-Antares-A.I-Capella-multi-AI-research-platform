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
    tagline: "Try every major AI in one place.",
    dailyMessages: 25,
    research: false,
    features: [
      "25 messages a day",
      "Chat with Claude, ChatGPT, Gemini, Grok, or DeepSeek",
      "Sync across all your devices",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceCents: 1999,
    tagline: "For everyday power users.",
    dailyMessages: 500,
    research: true,
    features: [
      "500 messages a day (a Deep Dive uses 5)",
      "Deep Dive: every AI model cross-checked, with cited sources",
      "Choose any AI model for chat",
      "Sync across all your devices",
    ],
  },
  max: {
    id: "max",
    name: "Max",
    priceCents: 4999,
    tagline: "For professionals who research all day.",
    dailyMessages: 2000,
    research: true,
    features: [
      "2,000 messages a day",
      "Everything in Pro, with 4x the Deep Dives",
      "Early access to Antares Shield",
      "Early access to video creation",
    ],
  },
};

/** A Deep Dive consults several models, so it counts as this many messages. */
export const DEEP_DIVE_COST = 5;

export const PAID_PLANS = [PLANS.pro, PLANS.max];

export const isPlanId = (v: unknown): v is PlanId => v === "free" || v === "pro" || v === "max";

export const formatPrice = (cents: number) => (cents === 0 ? "$0" : `$${(cents / 100).toFixed(2)}`);
