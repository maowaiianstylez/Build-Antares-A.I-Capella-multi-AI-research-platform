import { createDeviceCode, currentUser, redeemDeviceCode, startSession } from "@/lib/auth";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";

// POST -> a short single-use code that signs another device into this account.
export async function POST() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { code, expiresAt } = await createDeviceCode(user.id);
  return Response.json({ code, expiresAt });
}

// PUT { code } -> signs this device in.
export async function PUT(request: Request) {
  if (await tooManyAttempts(`link:${clientIp(request)}`, 20)) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const { code } = await request.json().catch(() => ({}));
  const userId = typeof code === "string" ? await redeemDeviceCode(code) : null;
  if (!userId) return Response.json({ error: "That code has expired or doesn't exist." }, { status: 404 });
  await startSession(userId);
  return Response.json({ ok: true });
}
