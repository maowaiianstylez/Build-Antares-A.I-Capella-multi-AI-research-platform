// The AI platforms Antares can consult. Claude is called through the Anthropic SDK in
// antares.ts; the others all publish OpenAI-compatible chat endpoints, so one client covers them.
import OpenAI from "openai";

export type ProviderId = "claude" | "openai" | "gemini" | "grok" | "deepseek";

type ProviderConfig = {
  id: ProviderId;
  name: string;
  company: string;
  envKey: string;
  modelEnv: string;
  // Defaults can go stale as providers ship new models; override with the *_MODEL env vars.
  defaultModel: string;
  baseURL?: string;
};

// Optional per-provider endpoint override (e.g. OPENAI_BASE_URL), for gateways or regional endpoints.
const baseUrlEnv = (id: ProviderId) => `${id === "grok" ? "XAI" : id.toUpperCase()}_BASE_URL`;

const CONFIG: ProviderConfig[] = [
  {
    id: "claude",
    name: "Claude",
    company: "Anthropic",
    envKey: "ANTHROPIC_API_KEY",
    modelEnv: "ANTARES_MODEL",
    defaultModel: "claude-opus-5-5",
  },
  {
    id: "openai",
    name: "ChatGPT",
    company: "OpenAI",
    envKey: "OPENAI_API_KEY",
    modelEnv: "OPENAI_MODEL",
    defaultModel: "gpt-5.6-sol",
  },
  {
    id: "gemini",
    name: "Gemini",
    company: "Google",
    envKey: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-3.1-pro-preview",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  },
  {
    id: "grok",
    name: "Grok",
    company: "xAI",
    envKey: "XAI_API_KEY",
    modelEnv: "XAI_MODEL",
    defaultModel: "grok-4.5",
    baseURL: "https://api.x.ai/v1",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    company: "DeepSeek",
    envKey: "DEEPSEEK_API_KEY",
    modelEnv: "DEEPSEEK_MODEL",
    defaultModel: "deepseek-v4-pro",
    baseURL: "https://api.deepseek.com",
  },
];

export type ProviderInfo = { id: ProviderId; name: string; company: string; model: string };

const info = (c: ProviderConfig): ProviderInfo => ({
  id: c.id,
  name: c.name,
  company: c.company,
  model: process.env[c.modelEnv] || c.defaultModel,
});

export const isProviderId = (v: unknown): v is ProviderId => CONFIG.some((c) => c.id === v);

export const providerInfo = (id: ProviderId) => info(CONFIG.find((c) => c.id === id)!);

/** Providers with an API key configured on this server. */
export const availableProviders = (): ProviderInfo[] =>
  CONFIG.filter((c) => process.env[c.envKey]).map(info);

/** Every provider, configured or not; used to describe the platform when keys are missing. */
export const allProviders = (): ProviderInfo[] => CONFIG.map(info);

const clients = new Map<ProviderId, OpenAI>();

function clientFor(id: Exclude<ProviderId, "claude">) {
  const c = CONFIG.find((p) => p.id === id)!;
  let client = clients.get(id);
  if (!client) {
    client = new OpenAI({
      apiKey: process.env[c.envKey],
      baseURL: process.env[baseUrlEnv(id)] || c.baseURL,
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
