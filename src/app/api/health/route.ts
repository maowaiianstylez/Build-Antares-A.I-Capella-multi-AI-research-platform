import { connection } from "next/server";
import { db } from "@/lib/db";

// Used by the hosting platform to check the app and its database are up.
export async function GET() {
  await connection(); // always check at request time, never during the build
  try {
    const sql = await db();
    await sql`select 1`;
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Health check failed", err);
    return Response.json({ ok: false }, { status: 503 });
  }
}
