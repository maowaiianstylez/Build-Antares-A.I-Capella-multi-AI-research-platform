import { connection } from "next/server";
import { emailList, ownerResetEnabled } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailEnabled } from "@/lib/email";

// Used by the hosting platform to check the app and its database are up.
export async function GET() {
  await connection(); // always check at request time, never during the build
  try {
    const sql = await db();
    await sql`select 1`;
    // Setup summary to help debug Railway variables. Counts and on/off only, never the values.
    return Response.json({
      ok: true,
      setup: {
        adminEmails: emailList(process.env.ADMIN_EMAILS).size,
        ownerEmails: emailList(process.env.OWNER_EMAILS).size,
        resetEmails: emailEnabled(),
        ownerReset: ownerResetEnabled(),
      },
    });
  } catch (err) {
    console.error("Health check failed", err);
    return Response.json({ ok: false }, { status: 503 });
  }
}
