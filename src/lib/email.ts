import { Resend } from "resend";

let client: Resend | null = null;

export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/**
 * Sends a transactional email through Resend. Without RESEND_API_KEY and EMAIL_FROM
 * (e.g. in development) the message is printed to the server log instead.
 */
export async function sendEmail(to: string, subject: string, text: string) {
  if (!emailEnabled()) {
    console.log(`[email not configured] To: ${to}\nSubject: ${subject}\n\n${text}`);
    return;
  }
  client ??= new Resend(process.env.RESEND_API_KEY);
  const { error } = await client.emails.send({ from: process.env.EMAIL_FROM!, to, subject, text });
  if (error) console.error("Email send failed", error);
}
