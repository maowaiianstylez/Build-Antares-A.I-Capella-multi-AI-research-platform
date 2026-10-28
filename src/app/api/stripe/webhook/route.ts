import type Stripe from "stripe";
import { findUserByStripeCustomer, getUserById, updateUser } from "@/lib/auth";
import { ACTIVE_STATUSES, stripe } from "@/lib/billing";
import { isPlanId } from "@/lib/plans";

// Stripe calls this after checkout and whenever a subscription changes. The signature check
// is what makes it safe: plan changes only ever come from verified Stripe events.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Webhook not configured", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(await request.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.client_reference_id ?? session.metadata?.userId;
      const plan = session.metadata?.plan;
      const user = userId ? await getUserById(userId) : null;
      if (user && isPlanId(plan)) {
        await updateUser(user.id, {
          plan,
          stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
          stripeSubscriptionId:
            typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
          subscriptionStatus: "active",
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      // Events can arrive out of order, so act on the subscription's current state, not the snapshot.
      const sub =
        event.type === "customer.subscription.deleted"
          ? event.data.object
          : await stripe().subscriptions.retrieve(event.data.object.id);
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const user = await findUserByStripeCustomer(customerId);
      if (!user) break;
      // Ignore events for an older subscription once the user has a newer one.
      if (user.stripeSubscriptionId && user.stripeSubscriptionId !== sub.id) break;
      const plan = sub.metadata?.plan;
      const active = event.type !== "customer.subscription.deleted" && ACTIVE_STATUSES.has(sub.status);
      await updateUser(user.id, {
        plan: active && isPlanId(plan) ? plan : "free",
        stripeSubscriptionId: sub.id,
        subscriptionStatus: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
      });
      break;
    }
  }
  return Response.json({ received: true });
}
