import { cookies } from "next/headers";
import { SESSION_COOKIE, checkPassword, currentUser, deleteUserAccount, toPublicUser } from "@/lib/auth";
import { hasApiKey } from "@/lib/antares";
import { ACTIVE_STATUSES, billingEnabled, stripe } from "@/lib/billing";
import { availableProviders } from "@/lib/providers";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  return Response.json({
    user: toPublicUser(user),
    live: hasApiKey(),
    billing: billingEnabled(),
    providers: availableProviders().map(({ id, name, company, region }) => ({ id, name, company, region })),
  });
}

/**
 * Deletes the signed-in account for good (Apple guideline 5.1.1(v) and Google Play's account
 * deletion policy both require this inside the app). The password is asked for again so a phone
 * left unlocked can't wipe someone's account. A paid subscription is cancelled right away so the
 * person is never billed again.
 */
export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (await tooManyAttempts(`delete:${clientIp(request)}:${user.id}`, 5)) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  if (!(await checkPassword(user, String(body.password ?? "")))) {
    return Response.json({ error: "That password isn't right." }, { status: 401 });
  }

  if (user.stripeSubscriptionId && billingEnabled() && ACTIVE_STATUSES.has(user.subscriptionStatus ?? "")) {
    try {
      await stripe().subscriptions.cancel(user.stripeSubscriptionId);
    } catch (err) {
      // Never delete the account while a paid plan might keep billing the person.
      console.error("Couldn't cancel subscription before account deletion", err);
      return Response.json(
        { error: "We couldn't cancel your subscription, so nothing was deleted. Please try again or contact support." },
        { status: 502 },
      );
    }
  }

  await deleteUserAccount(user.id);
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
