import { getUserById } from "@/lib/auth";
import { requireAdmin, setSuspended } from "@/lib/admin";
import { isValidId } from "@/lib/store";

// POST { action: "suspend" | "unsuspend" } -> suspends (and signs out everywhere) or restores an account.
export async function POST(request: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  const { admin, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;
  const { action } = await request.json().catch(() => ({}));
  if (action !== "suspend" && action !== "unsuspend") {
    return Response.json({ error: "Unknown action." }, { status: 400 });
  }
  const target = isValidId(id) ? await getUserById(id) : null;
  if (!target) return Response.json({ error: "No such account." }, { status: 404 });
  if (action === "suspend") {
    if (target.id === admin.id) return Response.json({ error: "You can't suspend your own account." }, { status: 400 });
    if (target.isAdmin) {
      return Response.json(
        { error: "Admin accounts can't be suspended. Remove them from ADMIN_EMAILS/OWNER_EMAILS first." },
        { status: 400 },
      );
    }
  }
  await setSuspended(target.id, action === "suspend");
  console.info(`[admin] ${admin.email} ${action}ed ${target.email}`);
  return Response.json({ ok: true });
}
