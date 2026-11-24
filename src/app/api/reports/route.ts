import crypto from "crypto";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { supportInbox } from "@/lib/site";
import { isValidId } from "@/lib/store";

const REASONS = new Set(["harmful", "offensive", "sexual", "wrong", "privacy", "other"]);

/**
 * "Report" under an answer. Google Play's AI-generated content policy requires a way to flag
 * offensive AI output inside the app, and Apple expects the same for apps that show generated content.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (await tooManyAttempts(`report:${clientIp(request)}:${user.id}`, 20, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many reports. Please try again later." }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  const reason = REASONS.has(body.reason) ? String(body.reason) : "other";
  const details = String(body.details ?? "").trim().slice(0, 2000) || null;
  const conversationId = isValidId(body.conversationId) ? body.conversationId : null;
  const messageId = isValidId(body.messageId) ? body.messageId : null;

  const sql = await db();
  // Keep a copy of the reported answer, so it can still be reviewed if the conversation is deleted.
  let excerpt: string | null = null;
  if (conversationId && messageId) {
    const [row] = await sql<{ text: string }[]>`
      select m.text from messages m join conversations c on c.id = m.conversation_id
      where m.id = ${messageId} and c.id = ${conversationId} and c.user_id = ${user.spaceId}`;
    excerpt = row?.text.slice(0, 4000) ?? null;
  }
  const id = crypto.randomUUID();
  await sql`insert into content_reports (id, user_id, conversation_id, message_id, reason, details, excerpt)
            values (${id}, ${user.id}, ${conversationId}, ${messageId}, ${reason}, ${details}, ${excerpt})`;

  const inbox = supportInbox();
  if (inbox) {
    await sendEmail(
      inbox,
      `[Rehua report] ${reason}`,
      `Report ${id} from ${user.email}\nReason: ${reason}\nDetails: ${details ?? "(none)"}\n\nReported answer:\n${excerpt ?? "(not found)"}`,
    );
  }
  return Response.json({ ok: true });
}
