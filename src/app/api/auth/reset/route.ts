import { resetPassword, startSession, suspendedResponse } from "@/lib/auth";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";

// POST { token, password } -> sets the new password and signs this device in.
export async function POST(request: Request) {
  if (await tooManyAttempts(`reset:${clientIp(request)}`, 10)) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const { token, password } = await request.json().catch(() => ({}));
  if (typeof password !== "string" || password.length < 8 || password.length > 200) {
    return Response.json({ error: "Use a password of at least 8 characters." }, { status: 400 });
  }
  const userId = typeof token === "string" ? await resetPassword(token, password) : null;
  if (!userId) {
    return Response.json({ error: "This reset link has expired or was already used. Request a new one." }, { status: 400 });
  }
  try {
    await startSession(userId);
  } catch (err) {
    return suspendedResponse(err);
  }
  return Response.json({ ok: true });
}
