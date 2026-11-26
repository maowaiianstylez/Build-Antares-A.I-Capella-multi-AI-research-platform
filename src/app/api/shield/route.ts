import { consumeMessage, currentUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { MAX_SCAN_CHARS, runShieldScan } from "@/lib/shield";

/**
 * POST { content } -> ShieldResult
 * Checks text the user pasted in for scam and threat signs. The content is not stored:
 * it is checked and discarded. A scan counts as one message toward the daily limit.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Please sign in to use Shield." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) return Response.json({ error: "Paste a message, email, or link to check." }, { status: 400 });
  if (content.length > MAX_SCAN_CHARS) {
    return Response.json(
      { error: `That's too long to check. Paste up to ${MAX_SCAN_CHARS.toLocaleString()} characters.` },
      { status: 400 },
    );
  }

  if (!(await consumeMessage(user.id, 1))) {
    const plan = PLANS[user.plan];
    return Response.json(
      {
        error: `You've used all ${plan.dailyMessages} messages on the ${plan.name} plan today. Upgrade for more, or come back tomorrow.`,
        upgrade: true,
      },
      { status: 429 },
    );
  }

  try {
    return Response.json(await runShieldScan(content));
  } catch (err) {
    console.error("Shield scan failed", err);
    return Response.json({ error: "The check failed. Try again in a moment." }, { status: 500 });
  }
}
