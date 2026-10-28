import { currentUser, toPublicUser } from "@/lib/auth";
import { hasApiKey } from "@/lib/antares";
import { billingEnabled } from "@/lib/billing";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  return Response.json({ user: toPublicUser(user), live: hasApiKey(), billing: billingEnabled() });
}
