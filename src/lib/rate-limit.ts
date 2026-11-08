// Attempt limiter for sign-in, sign-up, and similar endpoints. Stored in Postgres so the
// limit holds across every server instance.
import { db } from "./db";

export async function tooManyAttempts(key: string, max = 10, windowMs = 15 * 60 * 1000) {
  const sql = await db();
  const since = new Date(Date.now() - windowMs);
  const [{ count }] = await sql<{ count: number }[]>`
    with cleanup as (delete from attempts where at < now() - interval '1 day'),
    ins as (insert into attempts (key) values (${key}))
    select count(*)::int + 1 as count from attempts where key = ${key} and at >= ${since}`;
  return count > max;
}

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
