import { currentUser } from "@/lib/auth";
import { deleteConversation, getConversation } from "@/lib/store";

export async function GET(_request: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  const conversation = await getConversation(user.spaceId, id);
  if (!conversation) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ conversation });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  await deleteConversation(user.spaceId, id);
  return Response.json({ ok: true });
}
