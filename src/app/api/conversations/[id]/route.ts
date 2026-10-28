import { deleteConversation, getConversation } from "@/lib/store";

export async function GET(request: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  const { id } = await ctx.params;
  const space = new URL(request.url).searchParams.get("space") ?? "";
  const conversation = await getConversation(space, id);
  if (!conversation) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ conversation });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  const { id } = await ctx.params;
  const space = new URL(request.url).searchParams.get("space") ?? "";
  await deleteConversation(space, id);
  return Response.json({ ok: true });
}
