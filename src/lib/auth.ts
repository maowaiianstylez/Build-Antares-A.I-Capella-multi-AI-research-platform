// Accounts, sessions, plan usage, device sign-in codes, and password resets, stored in Postgres.
import crypto from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import { db } from "./db";
import { PLANS, isPlanId, type PlanId } from "./plans";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "antares_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEVICE_CODE_TTL_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  /** Owner key for conversations; every device signed into this account shares it. */
  spaceId: string;
  plan: PlanId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  usage: { day: string; count: number };
  createdAt: number;
};

export type PublicUser = Pick<User, "id" | "email" | "name" | "plan" | "subscriptionStatus"> & {
  usedToday: number;
  dailyLimit: number;
  hasBilling: boolean;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  plan: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  usage_day: string;
  usage_count: number;
  created_at: Date;
};

/** Emails in OWNER_EMAILS (comma-separated) always get the Max plan, so the owner can test every feature for free. */
const ownerEmails = () =>
  new Set((process.env.OWNER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));

const planFor = (r: UserRow): PlanId =>
  ownerEmails().has(r.email.toLowerCase()) ? "max" : isPlanId(r.plan) ? r.plan : "free";

const toUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email,
  name: r.name,
  passwordHash: r.password_hash,
  spaceId: r.id,
  plan: planFor(r),
  stripeCustomerId: r.stripe_customer_id ?? undefined,
  stripeSubscriptionId: r.stripe_subscription_id ?? undefined,
  subscriptionStatus: r.subscription_status ?? undefined,
  usage: { day: r.usage_day, count: r.usage_count },
  createdAt: r.created_at.getTime(),
});

// usage_day comes back as a plain YYYY-MM-DD string rather than a Date.
const userColumns = (t = "users") =>
  `${t}.id, ${t}.email, ${t}.name, ${t}.password_hash, ${t}.plan, ${t}.stripe_customer_id,
   ${t}.stripe_subscription_id, ${t}.subscription_status,
   to_char(${t}.usage_day, 'YYYY-MM-DD') as usage_day, ${t}.usage_count, ${t}.created_at`;

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const today = () => new Date().toISOString().slice(0, 10);

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [, salt, hex] = stored.split(":");
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return expected.length === key.length && crypto.timingSafeEqual(expected, key);
}

async function selectUser(where: string, value: string) {
  const sql = await db();
  const [row] = await sql.unsafe<UserRow[]>(`select ${userColumns()} from users where ${where} = $1`, [value]);
  return row ? toUser(row) : null;
}

export async function createUser(email: string, password: string, name: string) {
  const sql = await db();
  const passwordHash = await hashPassword(password);
  const rows = await sql.unsafe<UserRow[]>(
    `insert into users (id, email, name, password_hash) values ($1, $2, $3, $4)
     on conflict (email) do nothing returning ${userColumns()}`,
    [crypto.randomUUID(), email, name, passwordHash],
  );
  return rows[0] ? toUser(rows[0]) : null;
}

export async function authenticate(email: string, password: string) {
  const user = await findUserByEmail(email);
  // Hash anyway on a miss so response time doesn't reveal which emails exist.
  const ok = await verifyPassword(password, user?.passwordHash ?? `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`);
  return user && ok ? user : null;
}

export const getUserById = (id: string) => selectUser("id", id);
export const findUserByEmail = (email: string) => selectUser("email", email);
export const findUserByStripeCustomer = (customerId: string) => selectUser("stripe_customer_id", customerId);

const PATCHABLE: Partial<Record<keyof User, string>> = {
  name: "name",
  passwordHash: "password_hash",
  plan: "plan",
  stripeCustomerId: "stripe_customer_id",
  stripeSubscriptionId: "stripe_subscription_id",
  subscriptionStatus: "subscription_status",
};

export async function updateUser(id: string, patch: Partial<User>) {
  const sql = await db();
  const sets: string[] = [];
  const values: (string | null)[] = [id];
  for (const [key, column] of Object.entries(PATCHABLE) as [keyof User, string][]) {
    if (key in patch) {
      values.push((patch[key] as string | undefined) ?? null);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (!sets.length) return getUserById(id);
  const [row] = await sql.unsafe<UserRow[]>(
    `update users set ${sets.join(", ")} where id = $1 returning ${userColumns()}`,
    values,
  );
  return row ? toUser(row) : null;
}

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    plan: u.plan,
    subscriptionStatus: u.subscriptionStatus,
    usedToday: u.usage.day === today() ? u.usage.count : 0,
    dailyLimit: PLANS[u.plan].dailyMessages,
    hasBilling: Boolean(u.stripeCustomerId),
  };
}

/** Counts `cost` messages against the user's daily plan limit. Returns false when they're out. */
export async function consumeMessage(userId: string, cost = 1) {
  const user = await getUserById(userId);
  if (!user) return false;
  const sql = await db();
  const day = today();
  // One conditional update, so two devices sending at once can't both slip past the limit.
  const rows = await sql`
    update users set
      usage_count = (case when usage_day = ${day}::date then usage_count else 0 end) + ${cost},
      usage_day = ${day}::date
    where id = ${userId}
      and (case when usage_day = ${day}::date then usage_count else 0 end) + ${cost} <= ${PLANS[user.plan].dailyMessages}
    returning id`;
  return rows.length > 0;
}

// ---- Sessions ----

export async function startSession(userId: string) {
  const sql = await db();
  const token = crypto.randomBytes(32).toString("base64url");
  await sql`delete from sessions where expires_at < now()`;
  await sql`insert into sessions (token_hash, user_id, expires_at)
            values (${sha256(token)}, ${userId}, ${new Date(Date.now() + SESSION_TTL_MS)})`;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const sql = await db();
    await sql`delete from sessions where token_hash = ${sha256(token)}`;
  }
  jar.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const sql = await db();
  const [row] = await sql.unsafe<UserRow[]>(
    `select ${userColumns("u")}
     from sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [sha256(token)],
  );
  return row ? toUser(row) : null;
}

// ---- Device sign-in codes (sign a phone or car in without typing a password) ----

export async function createDeviceCode(userId: string) {
  const sql = await db();
  await sql`delete from device_codes where expires_at < now()`;
  // No 0/O/1/I so codes are easy to read aloud or type on a car screen.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from(crypto.randomBytes(6), (b) => alphabet[b % alphabet.length]).join("");
  const expiresAt = Date.now() + DEVICE_CODE_TTL_MS;
  await sql`insert into device_codes (code, user_id, expires_at) values (${code}, ${userId}, ${new Date(expiresAt)})`;
  return { code, userId, expiresAt };
}

/** Single-use: a redeemed code is deleted. */
export async function redeemDeviceCode(code: string) {
  const sql = await db();
  const [row] = await sql<{ user_id: string }[]>`
    delete from device_codes where code = ${code.trim().toUpperCase()} and expires_at > now() returning user_id`;
  return row?.user_id ?? null;
}

// ---- Password reset ----

/** Creates a single-use reset token (valid one hour), replacing any earlier one. Only its hash is stored. */
export async function createPasswordReset(userId: string) {
  const sql = await db();
  const token = crypto.randomBytes(32).toString("base64url");
  await sql`delete from password_resets where user_id = ${userId} or expires_at < now()`;
  await sql`insert into password_resets (token_hash, user_id, expires_at)
            values (${sha256(token)}, ${userId}, ${new Date(Date.now() + RESET_TTL_MS)})`;
  return token;
}

/** Sets a new password, signs the account out everywhere, and returns the user id. */
export async function resetPassword(token: string, password: string) {
  const sql = await db();
  const passwordHash = await hashPassword(password);
  return sql.begin(async (tx) => {
    const [hit] = await tx<{ user_id: string }[]>`
      delete from password_resets where token_hash = ${sha256(token)} and expires_at > now() returning user_id`;
    if (!hit) return null;
    await tx`update users set password_hash = ${passwordHash} where id = ${hit.user_id}`;
    await tx`delete from sessions where user_id = ${hit.user_id}`;
    return hit.user_id;
  });
}
