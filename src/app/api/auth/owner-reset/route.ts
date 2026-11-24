import crypto from "crypto";
import { createPasswordReset, findUserByEmail, isAdminEmail, normalizeEmail, ownerResetEnabled } from "@/lib/auth";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";

// Owner password reset that doesn't need email. Set OWNER_RESET_CODE (12+ characters) in the
// hosting dashboard; then an account listed in ADMIN_EMAILS or OWNER_EMAILS can get a reset link
// by typing that code at /owner-reset. Off unless the code is set.

const sameCode = (a: string, b: string) => {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

// POST { email, code } -> { resetUrl } for the reset page.
export async function POST(request: Request) {
  if (await tooManyAttempts(`owner-reset:${clientIp(request)}`, 5)) {
    return Response.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }
  if (!ownerResetEnabled()) {
    return Response.json(
      { error: "Owner reset is turned off. Add OWNER_RESET_CODE (at least 12 characters) in Railway first." },
      { status: 403 },
    );
  }
  const { email, code } = await request.json().catch(() => ({}));
  if (typeof email !== "string" || typeof code !== "string") {
    return Response.json({ error: "Enter your email and the owner reset code." }, { status: 400 });
  }
  const wrong = Response.json(
    { error: "That didn't match. Check the code, and that this email is in ADMIN_EMAILS or OWNER_EMAILS." },
    { status: 403 },
  );
  if (!sameCode(code.trim(), process.env.OWNER_RESET_CODE!.trim())) return wrong;
  const normalized = normalizeEmail(email);
  if (!isAdminEmail(normalized)) return wrong;
  const user = await findUserByEmail(normalized);
  if (!user) {
    return Response.json(
      { error: "No account uses this email yet. Sign up with it first, then it becomes an admin automatically." },
      { status: 404 },
    );
  }
  const token = await createPasswordReset(user.id);
  return Response.json({ resetUrl: `/reset?token=${token}` });
}
