// The AI platforms Antares can consult. Claude is called through the Anthropic SDK in
// antares.ts; the others all publish OpenAI-compatible chat endpoints, so one client covers them.
import OpenAI from "openai";

export type ProviderId = "claude" | "openai" | "gemini" | "grok" | "deepseek" | "kimi";

type ProviderConfig = {
  id: ProviderId;
  name: string;
  company: string;
  envKey: string;
  modelEnv: string;
  // Defaults can go stale as providers ship new models; override with the *_MODEL env vars.
  defaultModel: string;
  baseURL?: string;
  /** Optional endpoint override (e.g. OPENAI_BASE_URL), for gateways or regional endpoints. */
  baseUrlEnv?: string;
  /** Where the provider processes data, shown to users so they can choose knowingly. */
  region: "US" | "China";
  /** Core providers sit on the Deep Dive panel by default; the rest join only via DEEP_DIVE_PANEL. */
  core: boolean;
};

const CONFIG: ProviderConfig[] = [
  {
    id: "claude",
    name: "Claude",
    company: "Anthropic",
    envKey: "ANTHROPIC_API_KEY",
    modelEnv: "ANTARES_MODEL",
    defaultModel: "claude-opus-5-5",
    region: "US",
    core: true,
  },
  {
    id: "openai",
    name: "ChatGPT",
    company: "OpenAI",
    envKey: "OPENAI_API_KEY",
    modelEnv: "OPENAI_MODEL",
    defaultModel: "gpt-5.6-sol",
    baseUrlEnv: "OPENAI_BASE_URL",
    region: "US",
    core: true,
  },
  {
    id: "gemini",
    name: "Gemini",
    company: "Google",
    envKey: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
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
    envKey: "XAI_API_KEY",
    modelEnv: "XAI_MODEL",
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
    envKey: "DEEPSEEK_API_KEY",
    modelEnv: "DEEPSEEK_MODEL",
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
    envKey: "KIMI_API_KEY",
    modelEnv: "KIMI_MODEL",
    defaultModel: "kimi-k3.1-pro",
    baseURL: "https://api.moonshot.ai/v1",
    baseUrlEnv: "KIMI_BASE_URL",
    region: "China",
    core: false,
  },
];

export type ProviderInfo = {
  id: ProviderId;
  name: string;
  company: string;
  model: string;
  region: ProviderConfig["region"];
};

const info = (c: ProviderConfig): ProviderInfo => ({
  id: c.id,
  name: c.name,
  company: c.company,
  model: process.env[c.modelEnv] || c.defaultModel,
  region: c.region,
});

export const isProviderId = (v: unknown): v is ProviderId => CONFIG.some((c) => c.id === v);

export const providerInfo = (id: ProviderId) => info(CONFIG.find((c) => c.id === id)!);

/** Providers with an API key configured on this server. */
export const availableProviders = (): ProviderInfo[] =>
  CONFIG.filter((c) => process.env[c.envKey]).map(info);

/**
 * Deep Dive panel: the core providers that have keys, unless DEEP_DIVE_PANEL lists the members
 * explicitly (e.g. "claude,openai,gemini,grok,deepseek,kimi").
 */
export function panelProviders(): ProviderInfo[] {
  const listed = (process.env.DEEP_DIVE_PANEL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return CONFIG.filter((c) => process.env[c.envKey])
    .filter((c) => (listed.length ? listed.includes(c.id) : c.core))
    .map(info);
}

/** Every provider, configured or not; used to describe the platform when keys are missing. */
export const allProviders = (): ProviderInfo[] => CONFIG.map(info);

const clients = new Map<ProviderId, OpenAI>();

function clientFor(id: Exclude<ProviderId, "claude">) {
  const c = CONFIG.find((p) => p.id === id)!;
  let client = clients.get(id);
  if (!client) {
    client = new OpenAI({
      apiKey: process.env[c.envKey],
      baseURL: (c.baseUrlEnv && process.env[c.baseUrlEnv]) || c.baseURL,
      timeout: 120_000,
      maxRetries: 1,
    });
    clients.set(id, client);
  }
  return client;
}

export type SimpleMessage = { role: "user" | "assistant"; content: string };

/** Streams a reply from a non-Claude provider. */
export async function* streamCompatible(
  id: Exclude<ProviderId, "claude">,
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

/** One complete answer from a non-Claude provider (used by the Deep Dive panel). */
export async function askCompatible(
  id: Exclude<ProviderId, "claude">,
  system: string,
  prompt: string,
): Promise<string> {
  const res = await clientFor(id).chat.completions.create({
    model: providerInfo(id).model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}
