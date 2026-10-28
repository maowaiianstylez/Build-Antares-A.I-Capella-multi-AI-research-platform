import { createSpace, getSpace } from "@/lib/store";
import { hasApiKey } from "@/lib/antares";

// Create a new sync space (one per person for now; real accounts come later).
export async function POST() {
  const id = await createSpace();
  return Response.json({ spaceId: id });
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("space") ?? "";
  const space = await getSpace(id);
  return Response.json({ exists: Boolean(space), live: hasApiKey() });
}
