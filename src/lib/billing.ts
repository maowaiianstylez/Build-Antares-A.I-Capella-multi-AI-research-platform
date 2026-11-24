import Stripe from "stripe";
import { PLANS, isPlanId, type PlanId } from "./plans";

let client: Stripe | null = null;

export const billingEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);

// Created lazily so builds and demo mode work without Stripe keys.
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export const appUrl = (request: Request) => process.env.APP_URL ?? new URL(request.url).origin;

export type PaidPlanId = Exclude<PlanId, "free">;

/**
 * Each paid plan maps to one Stripe price, found by lookup key. The key includes the amount, so
 * changing a price in plans.ts makes a new Stripe price instead of silently reusing the old one.
 */
const lookupKey = (plan: PaidPlanId) => `rehua_capella_${plan}_monthly_${PLANS[plan].priceCents}`;

const envPriceId = (plan: PaidPlanId) =>
  plan === "pro" ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_MAX;

const priceCache = new Map<PaidPlanId, Stripe.Price>();

/**
 * Returns the Stripe price for a plan. With STRIPE_PRICE_PRO / STRIPE_PRICE_MAX set, those
 * dashboard prices are used. Otherwise the product and price are created in Stripe the first time
 * they are needed and reused after that, so nothing has to be set up by hand in the dashboard.
 */
export async function priceFor(plan: PaidPlanId): Promise<Stripe.Price> {
  const cached = priceCache.get(plan);
  if (cached) return cached;

  const fromEnv = envPriceId(plan);
  let price: Stripe.Price | undefined;
  if (fromEnv) {
    price = await stripe().prices.retrieve(fromEnv);
  } else {
    const key = lookupKey(plan);
    const find = async () => (await stripe().prices.list({ lookup_keys: [key], active: true, limit: 1 })).data[0];
    price = await find();
    if (!price) {
      try {
        price = await stripe().prices.create({
          currency: "usd",
          unit_amount: PLANS[plan].priceCents,
          recurring: { interval: "month" },
          lookup_key: key,
          product_data: { name: `Rehua A.I Capella ${PLANS[plan].name}`, metadata: { plan } },
          metadata: { plan },
        });
      } catch (err) {
        // Two first checkouts at once: the other request created it, so use that one.
        price = await find();
        if (!price) throw err;
      }
    }
  }
  priceCache.set(plan, price);
  return price;
}

const productId = (price: Stripe.Price) => (typeof price.product === "string" ? price.product : price.product.id);

/** Which plan a subscription is on, read from its price so plan switches in the portal are picked up. */
export function planFromSubscription(sub: Stripe.Subscription): PlanId | undefined {
  const price = sub.items?.data?.[0]?.price;
  if (price) {
    for (const plan of ["pro", "max"] as const) {
      if (price.id === envPriceId(plan) || price.metadata?.plan === plan) return plan;
      if (price.lookup_key?.startsWith(`rehua_capella_${plan}_`)) return plan;
    }
  }
  const fromMetadata = sub.metadata?.plan;
  return isPlanId(fromMetadata) ? fromMetadata : undefined;
}

let portalConfigId: string | null = null;

/**
 * The customer portal (update card, invoices, cancel, switch between Pro and Max). Stripe needs a
 * portal configuration before it will open one, so we create ours once and reuse it.
 */
export async function portalConfiguration(): Promise<string> {
  if (process.env.STRIPE_PORTAL_CONFIGURATION) return process.env.STRIPE_PORTAL_CONFIGURATION;
  if (portalConfigId) return portalConfigId;

  const prices = await Promise.all((["pro", "max"] as const).map((plan) => priceFor(plan)));
  const signature = prices.map((p) => p.id).join(",");
  const existing = await stripe().billingPortal.configurations.list({ active: true, limit: 100 });
  const match = existing.data.find((c) => c.metadata?.app === "rehua-capella" && c.metadata?.prices === signature);
  if (match) return (portalConfigId = match.id);

  const created = await stripe().billingPortal.configurations.create({
    name: "Rehua A.I Capella",
    metadata: { app: "rehua-capella", prices: signature },
    features: {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ["email", "name", "address"] },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        products: prices.map((p) => ({ product: productId(p), prices: [p.id] })),
      },
    },
  });
  return (portalConfigId = created.id);
}

export async function openPortal(customer: string, returnUrl: string) {
  return stripe().billingPortal.sessions.create({
    customer,
    return_url: returnUrl,
    configuration: await portalConfiguration(),
  });
}

/** Safe summary for /api/health: whether Stripe is set up and in which mode, never the keys. */
export function billingStatus() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  return {
    stripe: key ? (key.includes("_live_") ? "live" : "test") : "off",
    stripeWebhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  };
}

// Statuses where the customer keeps their paid plan. past_due keeps access while Stripe retries the card.
export const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);
