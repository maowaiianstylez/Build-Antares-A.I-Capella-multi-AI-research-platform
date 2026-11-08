// Postgres connection and schema. Set DATABASE_URL (Railway, Neon, Supabase, or any Postgres 14+).
// The schema is created on first use, so a fresh database needs no manual setup.
import postgres from "postgres";

let client: postgres.Sql | null = null;
let ready: Promise<void> | null = null;

const SCHEMA = `
create table if not exists users (
  id uuid primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,
  plan text not null default 'free',
  stripe_customer_id text unique,
  stripe_subscription_id text,
  subscription_status text,
  usage_day date not null default current_date,
  usage_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists sessions_user_idx on sessions(user_id);

create table if not exists device_codes (
  code text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists password_resets (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists conversations (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_user_idx on conversations(user_id, updated_at desc);

create table if not exists messages (
  id uuid primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null,
  text text not null default '',
  sources jsonb,
  panel jsonb,
  model_name text,
  device text,
  streaming boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists messages_convo_idx on messages(conversation_id, created_at);

create table if not exists attempts (
  key text not null,
  at timestamptz not null default now()
);
create index if not exists attempts_key_idx on attempts(key, at);
`;

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // Hosted Postgres needs TLS. Local databases and private networks (e.g. Railway's
  // *.railway.internal) don't, and DATABASE_SSL=disable turns it off explicitly.
  const noTls =
    process.env.DATABASE_SSL === "disable" || /@(localhost|127\.0\.0\.1|[^/:]+\.railway\.internal)[:/]/.test(url);
  return postgres(url, { ssl: noTls ? false : "require", max: 10, onnotice: () => {} });
}

/** The database client, with the schema guaranteed to exist. */
export async function db() {
  client ??= connect();
  ready ??= client.unsafe(SCHEMA).then(
    () => undefined,
    (err) => {
      ready = null; // let the next request retry instead of failing forever
      throw err;
    },
  );
  await ready;
  return client;
}
