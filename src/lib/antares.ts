import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, PanelEntry, Source } from "./store";
import {
  allProviders,
  askCompatible,
  availableProviders,
  providerInfo,
  streamCompatible,
  type ProviderId,
  type ProviderInfo,
} from "./providers";

/** "chat" talks to one model; "research" is Deep Dive: evidence, a panel of models, then a cross-checked answer. */
export type Mode = "chat" | "research";
export type ModelChoice = ProviderId | "auto";

export const MODEL = providerInfo("claude").model;

export const hasApiKey = () => availableProviders().length > 0;
const hasClaude = () => Boolean(process.env.ANTHROPIC_API_KEY);

const SYSTEM_PROMPT = `You are Antares, the AI in Antares A.I Capella, a research and results platform built by Antares Systems for everyday people.

You help with research, problem solving, math and calculations, programming, writing, and editing. A conversation may continue on a different device than the one it started on, so pick up naturally where things left off.

Be direct and warm. Lead with the answer, then the support for it. When you state facts someone could rely on, say how confident you are, and ground claims in sources when you have them. Show working for calculations. Use Markdown for structure and fenced code blocks for code. If the person may be on the move (for example they say they are driving), keep answers short and easy to listen to.`;

const EVIDENCE_PROMPT = `You are the evidence-gathering stage of Antares Deep Dive. Search the web for the user's latest question. Prefer primary and authoritative sources (official bodies, peer-reviewed research, original data, reputable outlets) and look for sources that disagree.

Write an evidence brief, not an answer: a list of the key facts and figures you found, each followed by the URL it came from, then a short note on where sources conflict or evidence is thin. Be neutral and complete; other models will reason from this brief.`;

const PANEL_PROMPT = `You are one of several independent AI analysts on an Antares Deep Dive panel. You'll get a question and an evidence brief gathered from the web. Answer the question on your own judgment. Use the evidence, say where you think it is weak, and add relevant knowledge of your own, marking anything not in the brief as such.

Format: start with a one-paragraph answer, then up to five bullet points of key reasoning, then a final line "Confidence: high, medium, or low" with a few words on why. Keep it under 350 words.`;

const SYNTHESIS_PROMPT = `You are Antares, writing the final answer of a Deep Dive. You have the user's question, an evidence brief with numbered sources, and independent answers from a panel of AI models. Cross-check the panel against the evidence and each other, then write the answer the user will rely on.

Structure:
1. **Answer**: the bottom line in two or three sentences.
2. **What the evidence shows**: the key points, each cited with source numbers like [1] or [2][4]. Only cite numbers from the source list.
3. **Where the models agree** and **where they differ**: name the models, and say which view the evidence supports better.
4. **Confidence**: high, medium, or low, and what would change it.

Do not invent sources. If the panel agrees on something the evidence does not support, say so.`;

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "status"; text: string }
  | { type: "source"; source: Source }
  | { type: "model"; provider: ProviderId; name: string }
  | { type: "panel"; entry: PanelEntry }
  | { type: "error"; message: string };

type ApiMessage = Anthropic.Beta.BetaMessageParam;

function toApiMessages(history: ChatMessage[]): ApiMessage[] {
  return history.filter((m) => m.text.trim()).map((m) => ({ role: m.role, content: m.text }));
}

/** Picks the model for a single-model chat: the user's choice if configured, otherwise Claude, otherwise anything available. */
export function resolveModel(choice: ModelChoice): ProviderInfo | null {
  const available = availableProviders();
  if (choice !== "auto") return available.find((p) => p.id === choice) ?? null;
  return available.find((p) => p.id === "claude") ?? available[0] ?? null;
}

/**
 * Streams Antares' reply: text, status, sources, which model answered, and Deep Dive panel results.
 */
export async function* runAntares(
  history: ChatMessage[],
  mode: Mode,
  choice: ModelChoice = "auto",
): AsyncGenerator<StreamEvent> {
  if (mode === "research") {
    yield* hasClaude() ? deepDive(history) : demoDeepDive(history.at(-1)?.text ?? "");
    return;
  }

  const target = hasApiKey() ? resolveModel(choice) : null;
  if (!target) {
    if (hasApiKey()) {
      yield { type: "error", message: `${providerInfo(choice as ProviderId).name} isn't connected on this server yet.` };
    } else {
      yield* demoReply(history.at(-1)?.text ?? "");
    }
    return;
  }

  yield { type: "model", provider: target.id, name: target.name };
  if (target.id === "claude") {
    yield* claudeStream({ system: SYSTEM_PROMPT, messages: toApiMessages(history), effort: "low", searches: 3 });
  } else {
    for await (const text of streamCompatible(target.id, SYSTEM_PROMPT, toApiMessages(history) as never)) {
      yield { type: "text", text };
    }
  }
}

// ---- Deep Dive ----

async function* deepDive(history: ChatMessage[]): AsyncGenerator<StreamEvent> {
  const question = history.at(-1)?.text ?? "";
  const context = history
    .slice(-7, -1)
    .map((m) => `${m.role === "user" ? "User" : "Antares"}: ${m.text.slice(0, 1500)}`)
    .join("\n\n");

  // 1. Evidence: Claude searches the web and writes a neutral brief.
  yield { type: "status", text: "Gathering evidence from the web…" };
  const sources: Source[] = [];
  let brief = "";
  for await (const ev of claudeStream({
    system: EVIDENCE_PROMPT,
    messages: toApiMessages(history),
    effort: "medium",
    searches: 8,
  })) {
    if (ev.type === "source") {
      sources.push(ev.source);
      yield ev;
    } else if (ev.type === "text") {
      brief += ev.text;
    } else if (ev.type === "status") {
      yield { type: "status", text: "Searching the web…" };
    } else if (ev.type === "error") {
      yield ev;
      return;
    }
  }
  const sourceList = sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`).join("\n");
  const casePrompt = `${context ? `Earlier conversation:\n${context}\n\n` : ""}Question: ${question}

Evidence brief:
${brief || "(No web evidence was found.)"}

Sources:
${sourceList || "(none)"}`;

  // 2. Panel: every connected model answers independently, in parallel.
  const panel = availableProviders();
  yield { type: "status", text: `Consulting ${panel.length} AI model${panel.length === 1 ? "" : "s"}: ${panel.map((p) => p.name).join(", ")}…` };
  const pending = new Map(
    panel.map((p) => [
      p.id,
      askPanelist(p, casePrompt).then((entry) => ({ id: p.id, entry })),
    ]),
  );
  const results: PanelEntry[] = [];
  while (pending.size) {
    const { id, entry } = await Promise.race(pending.values());
    pending.delete(id);
    results.push(entry);
    yield { type: "panel", entry };
  }

  // 3. Synthesis: Claude cross-checks the panel against the evidence and writes the answer.
  yield { type: "status", text: "Cross-checking the models and writing your answer…" };
  const panelText = results
    .map((r) => `### ${r.name} (${r.company}, ${r.model})\n${r.error ? `Did not answer: ${r.error}` : r.text}`)
    .join("\n\n");
  yield { type: "model", provider: "claude", name: "Antares Deep Dive" };
  yield* claudeStream({
    system: SYNTHESIS_PROMPT,
    messages: [{ role: "user", content: `${casePrompt}\n\nPanel answers:\n\n${panelText}` }],
    effort: "high",
    searches: 0,
  });
}

const PANEL_TIMEOUT_MS = 120_000;

async function askPanelist(p: ProviderInfo, prompt: string): Promise<PanelEntry> {
  const base = { provider: p.id, name: p.name, company: p.company, model: p.model };
  const run = async () => {
    if (p.id !== "claude") return askCompatible(p.id, PANEL_PROMPT, prompt);
    let text = "";
    for await (const ev of claudeStream({
      system: PANEL_PROMPT,
      messages: [{ role: "user", content: prompt }],
      effort: "low",
      searches: 0,
    })) {
      if (ev.type === "text") text += ev.text;
    }
    return text.trim();
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("took too long to answer")), PANEL_TIMEOUT_MS);
    });
    const text = await Promise.race([run(), timeout]);
    return text ? { ...base, text } : { ...base, error: "returned an empty answer" };
  } catch (err) {
    console.error(`Deep Dive panelist ${p.id} failed`, err);
    // Users see a plain reason; provider error details stay in the server log.
    const timedOut = err instanceof Error && err.message === "took too long to answer";
    return { ...base, error: timedOut ? "took too long to answer" : "was unavailable right now" };
  } finally {
    clearTimeout(timer);
  }
}

// ---- Claude ----

async function* claudeStream(opts: {
  system: string;
  messages: ApiMessage[];
  effort: "low" | "medium" | "high";
  searches: number;
}): AsyncGenerator<StreamEvent> {
  const client = new Anthropic();
  const messages = [...opts.messages];
  const seen = new Set<string>();

  // Web search runs server-side; a long search can pause the turn, so continue it a few times.
  for (let attempt = 0; attempt < 4; attempt++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      system: opts.system,
      messages,
      thinking: { type: "adaptive" },
      output_config: { effort: opts.effort },
      ...(opts.searches > 0 && {
        tools: [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: opts.searches }],
      }),
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        const block = event.content_block;
        if (block.type === "server_tool_use" && block.name === "web_search") {
          yield { type: "status", text: "Searching the web…" };
        } else if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
          for (const r of block.content) {
            if (!seen.has(r.url)) {
              seen.add(r.url);
              yield { type: "source", source: { url: r.url, title: r.title } };
            }
          }
        }
      } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { type: "text", text: event.delta.text };
      }
    }

    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      yield { type: "error", message: "Antares can't help with that request." };
      return;
    }
    if (final.stop_reason !== "pause_turn") return;
    messages.push({ role: "assistant", content: final.content as Anthropic.Beta.BetaContentBlockParam[] });
  }
}

// ---- Demo mode (no keys configured) ----

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function* typeOut(text: string): AsyncGenerator<StreamEvent> {
  for (const word of text.split(/(\s+)/)) {
    await sleep(10);
    yield { type: "text", text: word };
  }
}

async function* demoReply(prompt: string): AsyncGenerator<StreamEvent> {
  yield* typeOut(`**Antares is running in demo mode.** No AI provider keys are configured on this server yet, so this is a placeholder reply.

You asked: _"${prompt.slice(0, 200)}"_

Add \`ANTHROPIC_API_KEY\` (and optionally OpenAI, Gemini, xAI and DeepSeek keys) to the server environment and restart. Everything else here, including accounts, plans, and syncing across your devices, already works.`);
}

async function* demoDeepDive(prompt: string): AsyncGenerator<StreamEvent> {
  yield { type: "status", text: "Gathering evidence from the web…" };
  await sleep(600);
  yield { type: "source", source: { url: "https://example.com/demo-source", title: "Example source (demo)" } };
  const panel = allProviders();
  yield { type: "status", text: `Consulting ${panel.length} AI models…` };
  for (const p of panel) {
    await sleep(250);
    yield {
      type: "panel",
      entry: {
        provider: p.id,
        name: p.name,
        company: p.company,
        model: p.model,
        text: `_Demo answer from ${p.name}._ With a ${p.company} API key, ${p.name} would answer here independently so you can compare it with the other models.`,
      },
    };
  }
  yield { type: "status", text: "Cross-checking the models and writing your answer…" };
  await sleep(400);
  yield { type: "model", provider: "claude", name: "Antares Deep Dive" };
  yield* typeOut(`**Deep Dive is running in demo mode.**

You asked: _"${prompt.slice(0, 200)}"_

With API keys configured, Antares would search the web for evidence [1], ask each connected AI model the same question, and then cross-check their answers against the evidence and each other. The final answer shows where the models agree, where they differ, and how confident you can be.`);
}
