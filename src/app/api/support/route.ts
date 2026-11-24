import crypto from "crypto";
import { currentUser, isValidEmail, normalizeEmail } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { supportInbox } from "@/lib/site";

const TOPICS = new Set(["help", "billing", "delete", "report", "privacy", "other"]);

/** The support page form. Saved to the database and emailed to the support inbox. */
export async function POST(request: Request) {
  if (await tooManyAttempts(`support:${clientIp(request)}`, 5, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many messages. Please try again in an hour." }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email ?? ""));
  const topic = TOPICS.has(body.topic) ? String(body.topic) : "other";
  const message = String(body.message ?? "").trim().slice(0, 5000);
  if (!isValidEmail(email)) return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  if (message.length < 5) return Response.json({ error: "Please tell us a little more." }, { status: 400 });

  const user = await currentUser();
  const sql = await db();
  const id = crypto.randomUUID();
  await sql`insert into support_requests (id, email, topic, message, user_id)
            values (${id}, ${email}, ${topic}, ${message}, ${user?.id ?? null})`;

  const inbox = supportInbox();
  if (inbox) {
    await sendEmail(
      inbox,
      `[Rehua support] ${topic}: ${email}`,
      `From: ${email}${user ? ` (signed in as ${user.email})` : " (not signed in)"}\nTopic: ${topic}\nRequest id: ${id}\n\n${message}`,
    );
  } else {
    console.log(`[support request ${id}] ${topic} from ${email}: ${message}`);
  }
  return Response.json({ ok: true });
}
