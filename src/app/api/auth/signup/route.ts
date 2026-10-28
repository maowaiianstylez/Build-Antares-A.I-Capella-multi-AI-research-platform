import { createUser, isValidEmail, normalizeEmail, startSession, toPublicUser } from "@/lib/auth";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (tooManyAttempts(`signup:${clientIp(request)}`)) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email ?? ""));
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim().slice(0, 80);

  if (!isValidEmail(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 8 || password.length > 200) {
    return Response.json({ error: "Use a password of at least 8 characters." }, { status: 400 });
  }

  const user = await createUser(email, password, name || email.split("@")[0]);
  if (!user) return Response.json({ error: "An account with that email already exists." }, { status: 409 });
  await startSession(user.id);
  return Response.json({ user: toPublicUser(user) });
}
