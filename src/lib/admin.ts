// Owner/admin tools: who has signed up, what they pay, how much they use, and suspending accounts.
// Admins are the emails in ADMIN_EMAILS or OWNER_EMAILS (see isAdminEmail in auth.ts).
// Every admin API route and the /admin page check requireAdmin() on the server.
import { db } from "./db";
import { currentUser, isAdminEmail, isOwnerEmail, type User } from "./auth";
import { PLANS, isPlanId, type PlanId } from "./plans";

/** The signed-in admin, or a ready-made error response for anyone else. */
export async function requireAdmin(): Promise<{ admin: User; error?: never } | { admin?: never; error: Response }> {
  const user = await currentUser();
  if (!user) return { error: Response.json({ error: "Not signed in" }, { status: 401 }) };
  // 404 rather than 403, so the admin area doesn't advertise itself to regular users.
  if (!user.isAdmin) return { error: Response.json({ error: "Not found" }, { status: 404 }) };
  return { admin: user };
}

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  /** The plan they get, counting OWNER_EMAILS as Max. */
  plan: PlanId;
  /** The plan stored on the account (what Stripe has set). */
  billedPlan: PlanId;
  subscriptionStatus: string | null;
  hasBilling: boolean;
  usedToday: number;
  dailyLimit: number;
  conversations: number;
  messagesSent: number;
  lastActiveAt: number | null;
  createdAt: number;
  suspendedAt: number | null;
  isAdmin: boolean;
};

export type AdminStats = {
  totalUsers: number;
  newThisWeek: number;
  activeToday: number;
  messagesToday: number;
  payingUsers: number;
  pastDue: number;
  suspended: number;
  byPlan: Record<PlanId, number>;
  /** Monthly recurring revenue from active/trialing subscriptions, in cents. */
  mrrCents: number;
};

const today = () => new Date().toISOString().slice(0, 10);
const PAYING = ["active", "trialing"];

type Row = {
  id: string;
  email: string;
  name: string;
  plan: string;
  stripe_customer_id: string | null;
  subscription_status: string | null;
  usage_day: string;
  usage_count: number;
  created_at: Date;
  suspended_at: Date | null;
  conversations: number;
  messages_sent: number;
  last_active_at: Date | null;
};

export async function listUsers(search = "", limit = 200): Promise<AdminUserRow[]> {
  const sql = await db();
  const q = search.trim().slice(0, 100);
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await sql<Row[]>`
    select u.id, u.email, u.name, u.plan, u.stripe_customer_id, u.subscription_status,
           to_char(u.usage_day, 'YYYY-MM-DD') as usage_day, u.usage_count, u.created_at, u.suspended_at,
           coalesce(c.conversations, 0)::int as conversations,
           coalesce(m.messages_sent, 0)::int as messages_sent,
           c.last_active_at
    from users u
    left join (
      select user_id, count(*) as conversations, max(updated_at) as last_active_at
      from conversations group by user_id
    ) c on c.user_id = u.id
    left join (
      select cv.user_id, count(*) as messages_sent
      from messages ms join conversations cv on cv.id = ms.conversation_id
      where ms.role = 'user' group by cv.user_id
    ) m on m.user_id = u.id
    where ${q ? sql`(u.email ilike ${pattern} or u.name ilike ${pattern})` : sql`true`}
    order by u.created_at desc
    limit ${Math.min(Math.max(limit, 1), 500)}`;
  const day = today();
  return rows.map((r) => {
    const billedPlan: PlanId = isPlanId(r.plan) ? r.plan : "free";
    const plan: PlanId = isOwnerEmail(r.email) ? "max" : billedPlan;
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      plan,
      billedPlan,
      subscriptionStatus: r.subscription_status,
      hasBilling: Boolean(r.stripe_customer_id),
      usedToday: r.usage_day === day ? r.usage_count : 0,
      dailyLimit: PLANS[plan].dailyMessages,
      conversations: r.conversations,
      messagesSent: r.messages_sent,
      lastActiveAt: r.last_active_at?.getTime() ?? null,
      createdAt: r.created_at.getTime(),
      suspendedAt: r.suspended_at?.getTime() ?? null,
      isAdmin: isAdminEmail(r.email),
    };
  });
}

export async function getStats(): Promise<AdminStats> {
  const sql = await db();
  const day = today();
  const [s] = await sql<
    {
      total: number;
      new_week: number;
      active_today: number;
      messages_today: number;
      paying: number;
      past_due: number;
      suspended: number;
    }[]
  >`
    select count(*)::int as total,
           count(*) filter (where created_at > now() - interval '7 days')::int as new_week,
           count(*) filter (where usage_day = ${day}::date and usage_count > 0)::int as active_today,
           coalesce(sum(usage_count) filter (where usage_day = ${day}::date), 0)::int as messages_today,
           count(*) filter (where plan <> 'free' and subscription_status = any(${PAYING}))::int as paying,
           count(*) filter (where subscription_status = 'past_due')::int as past_due,
           count(*) filter (where suspended_at is not null)::int as suspended
    from users`;
  const plans = await sql<{ plan: string; n: number; paying: number }[]>`
    select plan, count(*)::int as n,
           count(*) filter (where subscription_status = any(${PAYING}))::int as paying
    from users group by plan`;
  const byPlan: Record<PlanId, number> = { free: 0, pro: 0, max: 0 };
  let mrrCents = 0;
  for (const p of plans) {
    const id: PlanId = isPlanId(p.plan) ? p.plan : "free";
    byPlan[id] += p.n;
    mrrCents += PLANS[id].priceCents * p.paying;
  }
  return {
    totalUsers: s.total,
    newThisWeek: s.new_week,
    activeToday: s.active_today,
    messagesToday: s.messages_today,
    payingUsers: s.paying,
    pastDue: s.past_due,
    suspended: s.suspended,
    byPlan,
    mrrCents,
  };
}

/**
 * Suspends or restores an account. Suspending also signs it out on every device at once.
 * It does not cancel a Stripe subscription; do that in the Stripe dashboard if needed.
 */
export async function setSuspended(userId: string, suspended: boolean) {
  const sql = await db();
  return sql.begin(async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      update users set suspended_at = ${suspended ? sql`coalesce(suspended_at, now())` : null}
      where id = ${userId} returning id`;
    if (!row) return false;
    if (suspended) {
      await tx`delete from sessions where user_id = ${userId}`;
      await tx`delete from device_codes where user_id = ${userId}`;
      await tx`delete from password_resets where user_id = ${userId}`;
    }
    return true;
  });
}
