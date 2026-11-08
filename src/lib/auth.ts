// Accounts, sessions, plan usage, and device sign-in codes.
// File-backed like the rest of the MVP; move to Postgres before production.
import crypto from "crypto";
import path from "path";
import { promisify } from "util";
import { cookies } from "next/headers";
import { DATA_DIR, createSpace, readJson, withLock, writeJson } from "./store";
import { PLANS, type PlanId } from "./plans";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "antares_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEVICE_CODE_TTL_MS = 10 * 60 * 1000;

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
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

type Session = { tokenHash: string; userId: string; expiresAt: number };
type DeviceCode = { code: string; userId: string; expiresAt: number };

const usersFile = path.join(DATA_DIR, "users.json");
const sessionsFile = path.join(DATA_DIR, "sessions.json");
const codesFile = path.join(DATA_DIR, "device-codes.json");

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const today = () => new Date().toISOString().slice(0, 10);

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;

async function loadUsers() {
  return (await readJson<Record<string, User>>(usersFile)) ?? {};
}

function mutateUsers<T>(fn: (users: Record<string, User>) => T | Promise<T>) {
  return withLock("users", async () => {
    const users = await loadUsers();
    const result = await fn(users);
    await writeJson(usersFile, users);
    return result;
  });
}

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

export async function createUser(email: string, password: string, name: string) {
  const passwordHash = await hashPassword(password);
  const spaceId = await createSpace();
  return mutateUsers((users) => {
    if (Object.values(users).some((u) => u.email === email)) return null;
    const user: User = {
      id: crypto.randomUUID(),
      email,
      name,
      passwordHash,
      spaceId,
      plan: "free",
      usage: { day: today(), count: 0 },
      createdAt: Date.now(),
    };
    users[user.id] = user;
    return user;
  });
}

export async function authenticate(email: string, password: string) {
  const user = Object.values(await loadUsers()).find((u) => u.email === email);
  // Hash anyway on a miss so response time doesn't reveal which emails exist.
  const ok = await verifyPassword(password, user?.passwordHash ?? `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`);
  return user && ok ? user : null;
}

export async function getUserById(id: string) {
  return (await loadUsers())[id] ?? null;
}

export async function findUserByStripeCustomer(customerId: string) {
  return Object.values(await loadUsers()).find((u) => u.stripeCustomerId === customerId) ?? null;
}

export function updateUser(id: string, patch: Partial<User>) {
  return mutateUsers((users) => {
    if (!users[id]) return null;
    Object.assign(users[id], patch);
    return users[id];
  });
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
export function consumeMessage(userId: string, cost = 1) {
  return mutateUsers((users) => {
    const u = users[userId];
    if (!u) return false;
    if (u.usage.day !== today()) u.usage = { day: today(), count: 0 };
    if (u.usage.count + cost > PLANS[u.plan].dailyMessages) return false;
    u.usage.count += cost;
    return true;
  });
}

// ---- Sessions ----

export async function startSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  await withLock("sessions", async () => {
    const now = Date.now();
    const sessions = ((await readJson<Session[]>(sessionsFile)) ?? []).filter((s) => s.expiresAt > now);
    sessions.push({ tokenHash: sha256(token), userId, expiresAt: now + SESSION_TTL_MS });
    await writeJson(sessionsFile, sessions);
  });
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
    const hash = sha256(token);
    await withLock("sessions", async () => {
      const sessions = (await readJson<Session[]>(sessionsFile)) ?? [];
      await writeJson(sessionsFile, sessions.filter((s) => s.tokenHash !== hash));
    });
  }
  jar.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const hash = sha256(token);
  const sessions = (await readJson<Session[]>(sessionsFile)) ?? [];
  const session = sessions.find((s) => s.tokenHash === hash && s.expiresAt > Date.now());
  return session ? getUserById(session.userId) : null;
}

// ---- Device sign-in codes (sign a phone or car in without typing a password) ----

export async function createDeviceCode(userId: string) {
  return withLock("codes", async () => {
    const now = Date.now();
    const codes = ((await readJson<DeviceCode[]>(codesFile)) ?? []).filter((c) => c.expiresAt > now);
    // No 0/O/1/I so codes are easy to read aloud or type on a car screen.
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from(crypto.randomBytes(6), (b) => alphabet[b % alphabet.length]).join("");
    const entry = { code, userId, expiresAt: now + DEVICE_CODE_TTL_MS };
    codes.push(entry);
    await writeJson(codesFile, codes);
    return entry;
  });
}

/** Single-use: a redeemed code is deleted. */
export async function redeemDeviceCode(code: string) {
  return withLock("codes", async () => {
    const now = Date.now();
    const codes = ((await readJson<DeviceCode[]>(codesFile)) ?? []).filter((c) => c.expiresAt > now);
    const hit = codes.find((c) => c.code === code.trim().toUpperCase());
    await writeJson(codesFile, codes.filter((c) => c !== hit));
    return hit?.userId ?? null;
  });
}
