import Stripe from "stripe";
import { PLANS, type PlanId } from "./plans";

let client: Stripe | null = null;

export const billingEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);

// Created lazily so builds and demo mode work without Stripe keys.
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export const appUrl = (request: Request) => process.env.APP_URL ?? new URL(request.url).origin;

/**
 * Prices are defined inline from PLANS, so no products need to be created in the Stripe
 * dashboard first. Set STRIPE_PRICE_PRO / STRIPE_PRICE_MAX to use dashboard prices instead.
 */
export function lineItemFor(plan: Exclude<PlanId, "free">): Stripe.Checkout.SessionCreateParams.LineItem {
  const priceId = plan === "pro" ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_MAX;
  if (priceId) return { price: priceId, quantity: 1 };
  return {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: PLANS[plan].priceCents,
      recurring: { interval: "month" },
      product_data: { name: `Antares A.I Capella ${PLANS[plan].name}` },
    },
  };
}

// Statuses where the customer keeps their paid plan. past_due keeps access while Stripe retries the card.
export const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);
