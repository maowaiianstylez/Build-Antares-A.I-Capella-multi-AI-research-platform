// File-backed store for the MVP. Every device that joins the same "space"
// sees the same conversations, which is what makes the cross-device handoff
// work. Swap this module for Postgres/Redis before production.
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export type Source = { url: string; title: string };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
  device?: string;
  streaming?: boolean;
  createdAt: number;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

type Space = {
  id: string;
  createdAt: number;
  conversations: Record<string, Conversation>;
};

type LinkCode = { code: string; spaceId: string; expiresAt: number };

const DATA_DIR = process.env.ANTARES_DATA_DIR ?? path.join(process.cwd(), ".data");
const LINK_TTL_MS = 10 * 60 * 1000;

const spacePath = (id: string) => path.join(DATA_DIR, "spaces", `${id}.json`);
const linksPath = () => path.join(DATA_DIR, "links.json");

const ID_RE = /^[a-f0-9-]{36}$/;
export const isValidId = (id: unknown): id is string =>
  typeof id === "string" && ID_RE.test(id);

// Serialize writes per file so concurrent stream updates can't clobber each other.
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(key, next.catch(() => undefined));
  return next;
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function writeJson(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data));
  await fs.rename(tmp, file);
}

export async function createSpace(): Promise<string> {
  const id = crypto.randomUUID();
  await writeJson(spacePath(id), { id, createdAt: Date.now(), conversations: {} });
  return id;
}

export async function getSpace(id: string): Promise<Space | null> {
  if (!isValidId(id)) return null;
  return readJson<Space>(spacePath(id));
}

function mutateSpace<T>(id: string, fn: (s: Space) => T): Promise<T | null> {
  return withLock(id, async () => {
    const space = await getSpace(id);
    if (!space) return null;
    const result = fn(space);
    await writeJson(spacePath(id), space);
    return result;
  });
}

export async function listConversations(spaceId: string) {
  const space = await getSpace(spaceId);
  if (!space) return null;
  return Object.values(space.conversations)
    .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createConversation(spaceId: string, title = "New conversation") {
  return mutateSpace(spaceId, (s) => {
    const now = Date.now();
    const convo: Conversation = {
      id: crypto.randomUUID(),
      title,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    s.conversations[convo.id] = convo;
    return convo;
  });
}

export async function getConversation(spaceId: string, convoId: string) {
  const space = await getSpace(spaceId);
  return space?.conversations[convoId] ?? null;
}

export function deleteConversation(spaceId: string, convoId: string) {
  return mutateSpace(spaceId, (s) => {
    delete s.conversations[convoId];
    return true;
  });
}

export function appendMessage(
  spaceId: string,
  convoId: string,
  msg: Omit<ChatMessage, "id" | "createdAt">,
) {
  return mutateSpace(spaceId, (s) => {
    const convo = s.conversations[convoId];
    if (!convo) return null;
    const full: ChatMessage = { ...msg, id: crypto.randomUUID(), createdAt: Date.now() };
    convo.messages.push(full);
    if (convo.messages.length === 1 && msg.role === "user") {
      convo.title = msg.text.slice(0, 60) || convo.title;
    }
    convo.updatedAt = Date.now();
    return full;
  });
}

export function updateMessage(
  spaceId: string,
  convoId: string,
  msgId: string,
  patch: Partial<Pick<ChatMessage, "text" | "sources" | "streaming">>,
) {
  return mutateSpace(spaceId, (s) => {
    const msg = s.conversations[convoId]?.messages.find((m) => m.id === msgId);
    if (!msg) return null;
    Object.assign(msg, patch);
    s.conversations[convoId].updatedAt = Date.now();
    return msg;
  });
}

export async function createLinkCode(spaceId: string): Promise<LinkCode> {
  return withLock("links", async () => {
    const now = Date.now();
    const links = ((await readJson<LinkCode[]>(linksPath())) ?? []).filter(
      (l) => l.expiresAt > now,
    );
    // Unambiguous alphabet (no 0/O/1/I) so codes are easy to read aloud or type in a car.
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from(crypto.randomBytes(6), (b) => alphabet[b % alphabet.length]).join("");
    const link = { code, spaceId, expiresAt: now + LINK_TTL_MS };
    links.push(link);
    await writeJson(linksPath(), links);
    return link;
  });
}

export async function redeemLinkCode(code: string): Promise<string | null> {
  const links = (await readJson<LinkCode[]>(linksPath())) ?? [];
  const hit = links.find((l) => l.code === code.toUpperCase() && l.expiresAt > Date.now());
  return hit?.spaceId ?? null;
}
