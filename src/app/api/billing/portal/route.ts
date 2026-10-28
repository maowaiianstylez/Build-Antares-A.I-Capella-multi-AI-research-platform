import { currentUser } from "@/lib/auth";
import { appUrl, billingEnabled, stripe } from "@/lib/billing";

// POST -> { url } of the Stripe customer portal (update card, see invoices, cancel).
export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (err) {
    console.error("Stripe %s failed", "portal", err);
    return Response.json({ error: "Billing is temporarily unavailable. Please try again." }, { status: 502 });
  }
}

async function handle(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  if (!billingEnabled() || !user.stripeCustomerId) {
    return Response.json({ error: "No billing account yet." }, { status: 400 });
  }
  const portal = await stripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appUrl(request)}/account`,
  });
  return Response.json({ url: portal.url });
}
