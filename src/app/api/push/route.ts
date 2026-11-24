import { currentUser } from "@/lib/auth";
import { removePushToken, savePushToken } from "@/lib/push";

const PLATFORMS = new Set(["ios", "android"]);

/** The app sends its push token here after the person allows notifications. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const token = String(body.token ?? "");
  const platform = String(body.platform ?? "");
  if (!PLATFORMS.has(platform) || !/^[\w:.\-]{20,4096}$/.test(token)) {
    return Response.json({ error: "Invalid token" }, { status: 400 });
  }
  await savePushToken(user.id, token, platform);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  await removePushToken(user.id, String(body.token ?? ""));
  return Response.json({ ok: true });
}
