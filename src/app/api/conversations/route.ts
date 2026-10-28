import { createConversation, listConversations } from "@/lib/store";

export async function GET(request: Request) {
  const space = new URL(request.url).searchParams.get("space") ?? "";
  const conversations = await listConversations(space);
  if (!conversations) return Response.json({ error: "Unknown space" }, { status: 404 });
  return Response.json({ conversations });
}

export async function POST(request: Request) {
  const { spaceId } = await request.json().catch(() => ({}));
  const convo = await createConversation(spaceId);
  if (!convo) return Response.json({ error: "Unknown space" }, { status: 404 });
  return Response.json({ conversation: convo });
}
