import { authenticate, normalizeEmail, startSession, toPublicUser } from "@/lib/auth";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email ?? ""));
  if (await tooManyAttempts(`signin:${clientIp(request)}:${email}`)) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const user = await authenticate(email, String(body.password ?? ""));
  if (!user) return Response.json({ error: "Wrong email or password." }, { status: 401 });
  await startSession(user.id);
  return Response.json({ user: toPublicUser(user) });
}
