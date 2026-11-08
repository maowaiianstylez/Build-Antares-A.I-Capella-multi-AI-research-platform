import { db } from "@/lib/db";

// Used by the hosting platform to check the app and its database are up.
export async function GET() {
  try {
    const sql = await db();
    await sql`select 1`;
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Health check failed", err);
    return Response.json({ ok: false }, { status: 503 });
  }
}
