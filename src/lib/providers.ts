// The AI models Rehua can run on. This is the one place that knows about vendors.
//
// - "rehua" is Rehua's own model: any self-hosted server that speaks the OpenAI-compatible
//   chat API (vLLM, Ollama, llama.cpp, NVIDIA NIM, a cloud GPU host...). Point REHUA_LLM_URL
//   at it and it is plugged in, no code change.
// - Claude is called through the Anthropic SDK in antares.ts (it also does web search).
// - The other partners publish OpenAI-compatible endpoints, so one client covers them.
//
// REHUA_MODE decides how independent Rehua runs (see rehuaMode() below).
import OpenAI from "openai";

export type ProviderId = "rehua" | "claude" | "openai" | "gemini" | "grok" | "deepseek" | "kimi";

/** How Rehua talks to a provider. */
export type ProviderKind = "self-hosted" | "anthropic" | "openai-compatible";

type ProviderConfig = {
  id: ProviderId;
  name: string;
  company: string;
  kind: ProviderKind;
  /** The env var whose presence means "this provider is connected on this server". */
  enabledEnv: string;
  /** The env var holding the API key, when it differs from enabledEnv. Self-hosted servers may need none. */
  apiKeyEnv?: string;
  /** Model name env vars, first one set wins (older names kept so existing deployments keep working). */
  modelEnv: string[];
  // Defaults can go stale as providers ship new models; override with the *_MODEL env vars.
  defaultModel: string;
  baseURL?: string;
  /** Optional endpoint override (e.g. OPENAI_BASE_URL), for gateways or regional endpoints. */
  baseUrlEnv?: string;
  /** Where the provider processes data, shown to users so they can choose knowingly. */
  region: string;
  /** Lets the operator say where a self-hosted model runs (defaults to `region`). */
  regionEnv?: string;
  /** Core providers sit on the Deep Dive panel by default; the rest join only via DEEP_DIVE_PANEL. */
  core: boolean;
};

const CONFIG: ProviderConfig[] = [
  {
    id: "rehua",
    name: "Rehua",
    company: "Rehua A.I Systems",
    kind: "self-hosted",
    enabledEnv: "REHUA_LLM_URL",
    apiKeyEnv: "REHUA_LLM_API_KEY",
    modelEnv: ["REHUA_LLM_MODEL"],
    // Matches `vllm serve <model> --served-model-name rehua-1`; set REHUA_LLM_MODEL for other servers
    // (for Ollama, e.g. "gpt-oss:20b").
    defaultModel: "rehua-1",
    baseUrlEnv: "REHUA_LLM_URL",
    region: "US",
    regionEnv: "REHUA_LLM_REGION",
    core: true,
  },
  {
    id: "claude",
    name: "Claude",
    company: "Anthropic",
    kind: "anthropic",
    enabledEnv: "ANTHROPIC_API_KEY",
    modelEnv: ["CLAUDE_MODEL", "ANTARES_MODEL"],
    defaultModel: "claude-opus-5-5",
    region: "US",
    core: true,
  },
  {
    id: "openai",
    name: "ChatGPT",
    company: "OpenAI",
    kind: "openai-compatible",
    enabledEnv: "OPENAI_API_KEY",
    modelEnv: ["OPENAI_MODEL"],
    defaultModel: "gpt-5.6-sol",
    baseUrlEnv: "OPENAI_BASE_URL",
    region: "US",
    core: true,
  },
  {
    id: "gemini",
    name: "Gemini",
    company: "Google",
    kind: "openai-compatible",
    enabledEnv: "GEMINI_API_KEY",
    modelEnv: ["GEMINI_MODEL"],
    defaultModel: "gemini-3.1-pro-preview",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    baseUrlEnv: "GEMINI_BASE_URL",
    region: "US",
    core: true,
  },
  {
    id: "grok",
    name: "Grok",
    company: "xAI",
    kind: "openai-compatible",
    enabledEnv: "XAI_API_KEY",
    modelEnv: ["XAI_MODEL"],
    defaultModel: "grok-4.5",
    baseURL: "https://api.x.ai/v1",
    baseUrlEnv: "XAI_BASE_URL",
    region: "US",
    core: true,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    company: "DeepSeek",
    kind: "openai-compatible",
    enabledEnv: "DEEPSEEK_API_KEY",
    modelEnv: ["DEEPSEEK_MODEL"],
    defaultModel: "deepseek-v4-pro",
    baseURL: "https://api.deepseek.com",
    baseUrlEnv: "DEEPSEEK_BASE_URL",
    region: "China",
    core: false,
  },
  {
    id: "kimi",
    name: "Kimi",
    company: "Moonshot AI",
    kind: "openai-compatible",
    enabledEnv: "KIMI_API_KEY",
    modelEnv: ["KIMI_MODEL"],
    defaultModel: "kimi-k3.1-pro",
    baseURL: "https://api.moonshot.ai/v1",
    baseUrlEnv: "KIMI_BASE_URL",
    region: "China",
    core: false,
  },
];

/**
 * How independent Rehua runs, set with REHUA_MODE:
 * - "hybrid" (default): partner models as today; Rehua's own model is one more choice when connected.
 * - "rehua-first": Rehua's own model answers first; partners only step in if it fails.
 * - "independent": only Rehua's own model is used; partner models are switched off entirely
 *   (what an offline, on-premises or defense deployment needs).
 */
export type RehuaMode = "hybrid" | "rehua-first" | "independent";

export function rehuaMode(): RehuaMode {
  const v = (process.env.REHUA_MODE ?? "").trim().toLowerCase();
  return v === "rehua-first" || v === "independent" ? v : "hybrid";
}

export type ProviderInfo = {
  id: ProviderId;
  name: string;
  company: string;
  kind: ProviderKind;
  model: string;
  region: string;
};

const env = (name?: string) => (name ? process.env[name]?.trim() || undefined : undefined);

const info = (c: ProviderConfig): ProviderInfo => ({
  id: c.id,
  name: c.name,
  company: c.company,
  kind: c.kind,
  model: c.modelEnv.map((n) => env(n)).find(Boolean) ?? c.defaultModel,
  region: env(c.regionEnv) ?? c.region,
});

const isConnected = (c: ProviderConfig) => Boolean(env(c.enabledEnv));

/** In independent mode, only Rehua's own (self-hosted) models count as connected. */
const allowed = (c: ProviderConfig) => rehuaMode() !== "independent" || c.kind === "self-hosted";

export const isProviderId = (v: unknown): v is ProviderId => CONFIG.some((c) => c.id === v);

export const providerInfo = (id: ProviderId) => info(CONFIG.find((c) => c.id === id)!);

/** Providers connected on this server (and allowed by REHUA_MODE). */
export const availableProviders = (): ProviderInfo[] =>
  CONFIG.filter((c) => isConnected(c) && allowed(c)).map(info);

export const isAvailable = (id: ProviderId) => availableProviders().some((p) => p.id === id);

/**
 * Deep Dive panel: the core providers that are connected, unless DEEP_DIVE_PANEL lists the members
 * explicitly (e.g. "rehua,claude,openai,gemini,grok,deepseek,kimi").
 */
export function panelProviders(): ProviderInfo[] {
  const listed = (process.env.DEEP_DIVE_PANEL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return CONFIG.filter((c) => isConnected(c) && allowed(c))
    .filter((c) => (listed.length ? listed.includes(c.id) : c.core))
    .map(info);
}

/** Every provider, configured or not; used to describe the platform when keys are missing. */
export const allProviders = (): ProviderInfo[] => CONFIG.map(info);

/** Providers reached through the OpenAI-compatible client (everything except Claude). */
export type CompatibleId = Exclude<ProviderId, "claude">;

const clients = new Map<string, OpenAI>();

function clientFor(id: CompatibleId) {
  const c = CONFIG.find((p) => p.id === id)!;
  const baseURL = env(c.baseUrlEnv) ?? c.baseURL;
  // Self-hosted servers (vLLM, Ollama) usually accept any key; the SDK just needs a non-empty one.
  const apiKey = env(c.apiKeyEnv ?? c.enabledEnv) ?? (c.kind === "self-hosted" ? "not-needed" : undefined);
  const cacheKey = `${id}|${baseURL}|${apiKey}`;
  let client = clients.get(cacheKey);
  if (!client) {
    client = new OpenAI({ apiKey, baseURL, timeout: 120_000, maxRetries: 1 });
    clients.set(cacheKey, client);
  }
  return client;
}

export type SimpleMessage = { role: "user" | "assistant"; content: string };

/** Streams a reply from any provider reached through the OpenAI-compatible API. */
export async function* streamCompatible(
  id: CompatibleId,
  system: string,
  messages: SimpleMessage[],
): AsyncGenerator<string> {
  const stream = await clientFor(id).chat.completions.create({
    model: providerInfo(id).model,
    stream: true,
    messages: [{ role: "system", content: system }, ...messages],
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

/** One complete answer from an OpenAI-compatible provider (used by the Deep Dive panel). */
export async function askCompatible(id: CompatibleId, system: string, prompt: string): Promise<string> {
  const res = await clientFor(id).chat.completions.create({
    model: providerInfo(id).model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}
