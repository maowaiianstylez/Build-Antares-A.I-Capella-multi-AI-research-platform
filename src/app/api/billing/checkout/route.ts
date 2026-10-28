import { currentUser, updateUser } from "@/lib/auth";
import { ACTIVE_STATUSES, appUrl, billingEnabled, lineItemFor, stripe } from "@/lib/billing";

// POST { plan: "pro" | "max" } -> { url } of a Stripe Checkout page.
export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (err) {
    console.error("Stripe %s failed", "checkout", err);
    return Response.json({ error: "Billing is temporarily unavailable. Please try again." }, { status: 502 });
  }
}

async function handle(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  if (!billingEnabled()) {
    return Response.json({ error: "Payments aren't set up on this server yet." }, { status: 503 });
  }
  const { plan } = await request.json().catch(() => ({}));
  if (plan !== "pro" && plan !== "max") return Response.json({ error: "Unknown plan" }, { status: 400 });

  const base = appUrl(request);
  // Already subscribed: changes and cancellations go through the billing portal instead.
  if (user.stripeCustomerId && user.subscriptionStatus && ACTIVE_STATUSES.has(user.subscriptionStatus)) {
    const portal = await stripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${base}/account`,
    });
    return Response.json({ url: portal.url });
  }

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await updateUser(user.id, { stripeCustomerId: customerId });
  }

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [lineItemFor(plan)],
    metadata: { userId: user.id, plan },
    subscription_data: { metadata: { userId: user.id, plan } },
    allow_promotion_codes: true,
    success_url: `${base}/account?checkout=success`,
    cancel_url: `${base}/pricing?checkout=cancelled`,
  });
  return Response.json({ url: session.url });
}
