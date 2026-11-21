import { getStats, listUsers, requireAdmin } from "@/lib/admin";

// GET ?q=search -> dashboard numbers plus the newest 200 accounts (or those matching the search).
export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const [stats, users] = await Promise.all([getStats(), listUsers(q)]);
  return Response.json({ stats, users });
}
