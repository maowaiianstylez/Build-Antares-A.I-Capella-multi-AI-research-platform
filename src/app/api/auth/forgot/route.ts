import { createPasswordReset, findUserByEmail, normalizeEmail } from "@/lib/auth";
import { appUrl } from "@/lib/billing";
import { sendEmail } from "@/lib/email";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";

// POST { email } -> emails a reset link. Always answers the same way so it can't be used
// to find out which emails have accounts.
export async function POST(request: Request) {
  if (await tooManyAttempts(`forgot:${clientIp(request)}`, 5)) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const { email } = await request.json().catch(() => ({}));
  const user = typeof email === "string" ? await findUserByEmail(normalizeEmail(email)) : null;
  if (user) {
    const token = await createPasswordReset(user.id);
    const link = `${appUrl(request)}/reset?token=${token}`;
    await sendEmail(
      user.email,
      "Reset your Antares password",
      `Hi ${user.name},\n\nSomeone asked to reset the password for your Antares A.I Capella account. If it was you, open this link within an hour:\n\n${link}\n\nIf it wasn't you, you can ignore this email and your password stays the same.\n\nAntares Systems`,
    );
  }
  return Response.json({ ok: true });
}
