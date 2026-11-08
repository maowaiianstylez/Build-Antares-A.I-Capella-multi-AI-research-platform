// Conversations and messages, stored in Postgres. Every device signed into the same account
// reads the same rows, which is what makes the cross-device handoff work.
import crypto from "crypto";
import { db } from "./db";

export type Source = { url: string; title: string };

/** One model's independent answer in a Deep Dive. */
export type PanelEntry = {
  provider: string;
  name: string;
  company: string;
  model: string;
  text?: string;
  error?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
  panel?: PanelEntry[];
  /** Which model wrote this reply, e.g. "Gemini" or "Antares Deep Dive". */
  modelName?: string;
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

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidId = (id: unknown): id is string => typeof id === "string" && ID_RE.test(id);

type MessageRow = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources: Source[] | null;
  panel: PanelEntry[] | null;
  model_name: string | null;
  device: string | null;
  streaming: boolean;
  created_at: Date;
};

const toMessage = (r: MessageRow): ChatMessage => ({
  id: r.id,
  role: r.role,
  text: r.text,
  sources: r.sources ?? undefined,
  panel: r.panel ?? undefined,
  modelName: r.model_name ?? undefined,
  device: r.device ?? undefined,
  streaming: r.streaming,
  createdAt: r.created_at.getTime(),
});

export async function listConversations(userId: string) {
  const sql = await db();
  const rows = await sql<{ id: string; title: string; updated_at: Date }[]>`
    select id, title, updated_at from conversations where user_id = ${userId} order by updated_at desc limit 200`;
  return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at.getTime() }));
}

export async function createConversation(userId: string, title = "New conversation"): Promise<Conversation> {
  const sql = await db();
  const id = crypto.randomUUID();
  const [row] = await sql<{ created_at: Date }[]>`
    insert into conversations (id, user_id, title) values (${id}, ${userId}, ${title}) returning created_at`;
  const t = row.created_at.getTime();
  return { id, title, createdAt: t, updatedAt: t, messages: [] };
}

export async function getConversation(userId: string, convoId: string): Promise<Conversation | null> {
  if (!isValidId(convoId)) return null;
  const sql = await db();
  const [c] = await sql<{ id: string; title: string; created_at: Date; updated_at: Date }[]>`
    select id, title, created_at, updated_at from conversations where id = ${convoId} and user_id = ${userId}`;
  if (!c) return null;
  const rows = await sql<MessageRow[]>`
    select id, role, text, sources, panel, model_name, device, streaming, created_at
    from messages where conversation_id = ${convoId} order by created_at`;
  return {
    id: c.id,
    title: c.title,
    createdAt: c.created_at.getTime(),
    updatedAt: c.updated_at.getTime(),
    messages: rows.map(toMessage),
  };
}

export async function deleteConversation(userId: string, convoId: string) {
  if (!isValidId(convoId)) return false;
  const sql = await db();
  await sql`delete from conversations where id = ${convoId} and user_id = ${userId}`;
  return true;
}

export async function appendMessage(
  userId: string,
  convoId: string,
  msg: Omit<ChatMessage, "id" | "createdAt">,
): Promise<ChatMessage | null> {
  if (!isValidId(convoId)) return null;
  const sql = await db();
  return sql.begin(async (tx) => {
    const [c] = await tx<{ id: string }[]>`
      update conversations set updated_at = now() where id = ${convoId} and user_id = ${userId} returning id`;
    if (!c) return null;
    const [row] = await tx<MessageRow[]>`
      insert into messages (id, conversation_id, role, text, sources, panel, model_name, device, streaming)
      values (${crypto.randomUUID()}, ${convoId}, ${msg.role}, ${msg.text},
              ${msg.sources ? tx.json(msg.sources) : null}, ${msg.panel ? tx.json(msg.panel) : null},
              ${msg.modelName ?? null}, ${msg.device ?? null}, ${msg.streaming ?? false})
      returning id, role, text, sources, panel, model_name, device, streaming, created_at`;
    // Name a new conversation after its first question.
    if (msg.role === "user") {
      await tx`
        update conversations set title = ${msg.text.slice(0, 60) || "New conversation"}
        where id = ${convoId} and (select count(*) from messages where conversation_id = ${convoId}) = 1`;
    }
    return toMessage(row);
  });
}

export async function updateMessage(
  userId: string,
  convoId: string,
  msgId: string,
  patch: Partial<Pick<ChatMessage, "text" | "sources" | "panel" | "modelName" | "streaming">>,
) {
  const sql = await db();
  const [row] = await sql<MessageRow[]>`
    update messages m set
      text = coalesce(${patch.text ?? null}, m.text),
      sources = coalesce(${patch.sources ? sql.json(patch.sources) : null}, m.sources),
      panel = coalesce(${patch.panel ? sql.json(patch.panel) : null}, m.panel),
      model_name = coalesce(${patch.modelName ?? null}, m.model_name),
      streaming = coalesce(${patch.streaming ?? null}, m.streaming)
    from conversations c
    where m.id = ${msgId} and m.conversation_id = ${convoId} and c.id = m.conversation_id and c.user_id = ${userId}
    returning m.id, m.role, m.text, m.sources, m.panel, m.model_name, m.device, m.streaming, m.created_at`;
  if (row) await sql`update conversations set updated_at = now() where id = ${convoId}`;
  return row ? toMessage(row) : null;
}
