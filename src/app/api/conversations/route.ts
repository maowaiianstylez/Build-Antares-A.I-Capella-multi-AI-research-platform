import { currentUser } from "@/lib/auth";
import { createConversation, listConversations } from "@/lib/store";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  return Response.json({ conversations: (await listConversations(user.spaceId)) ?? [] });
}

export async function POST() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  return Response.json({ conversation: await createConversation(user.spaceId) });
}
