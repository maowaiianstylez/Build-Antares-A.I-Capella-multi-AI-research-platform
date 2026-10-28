import { createLinkCode, getSpace, redeemLinkCode } from "@/lib/store";

// POST { spaceId } -> a short code another device can enter to join this space.
export async function POST(request: Request) {
  const { spaceId } = await request.json().catch(() => ({}));
  if (!(await getSpace(spaceId))) return Response.json({ error: "Unknown space" }, { status: 404 });
  const link = await createLinkCode(spaceId);
  return Response.json({ code: link.code, expiresAt: link.expiresAt });
}

// GET ?code=XXXXXX -> the space to join.
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code") ?? "";
  const spaceId = await redeemLinkCode(code);
  if (!spaceId) return Response.json({ error: "Code expired or not found" }, { status: 404 });
  return Response.json({ spaceId });
}
