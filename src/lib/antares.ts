import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, Source } from "./store";

export type Mode = "chat" | "research";

export const MODEL = process.env.ANTARES_MODEL ?? "claude-opus-5-5";

export const hasApiKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

const SYSTEM_PROMPT = `You are Antares, the personal AI assistant in Antares A.I Capella, built by Antares Systems for civilian use.

You help people with research, problem solving, math and calculations, programming, writing, and editing. You are the same assistant on every device the person uses (home, phone, tablet, computer, vehicle), and a conversation may continue on a different device than the one it started on, so pick up naturally where things left off.

Be direct and warm. Lead with the answer, then the support for it. When you state facts that someone could rely on, say how confident you are, and when you used web search, ground claims in the sources you found. Show working for calculations. Use Markdown for structure and fenced code blocks for code.

If the person may be on the move (for example they say they are driving), keep answers short and easy to listen to.`;

const RESEARCH_ADDENDUM = `Research mode is on. Search the web before answering, prefer primary and authoritative sources, compare sources when they disagree, and make sure every key claim is backed by a cited source. End with a one-line bottom line.`;

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "status"; text: string }
  | { type: "source"; source: Source }
  | { type: "error"; message: string };

function toApiMessages(history: ChatMessage[]): Anthropic.Beta.BetaMessageParam[] {
  return history
    .filter((m) => m.text.trim())
    .map((m) => ({ role: m.role, content: m.text }));
}

/**
 * Streams Antares' reply. Yields text, search status, and cited sources as they arrive.
 */
export async function* runAntares(
  history: ChatMessage[],
  mode: Mode,
): AsyncGenerator<StreamEvent> {
  if (!hasApiKey()) {
    yield* demoReply(history.at(-1)?.text ?? "");
    return;
  }

  const client = new Anthropic();
  const messages = toApiMessages(history);
  const system = mode === "research" ? `${SYSTEM_PROMPT}\n\n${RESEARCH_ADDENDUM}` : SYSTEM_PROMPT;
  const seen = new Set<string>();

  // Web search runs server-side; a long search can pause the turn, so continue it a few times.
  for (let attempt = 0; attempt < 4; attempt++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      system,
      messages,
      thinking: { type: "adaptive" },
      output_config: { effort: mode === "research" ? "high" : "low" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: mode === "research" ? 8 : 3 }],
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
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          yield { type: "text", text: event.delta.text };
        }
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

async function* demoReply(prompt: string): AsyncGenerator<StreamEvent> {
  const text = `**Antares is running in demo mode.** No AI key is configured on this server yet, so this is a placeholder reply.

You asked: _"${prompt.slice(0, 200)}"_

To bring Antares fully online, set \`ANTHROPIC_API_KEY\` in the server environment and restart. Everything else you see here, including conversation history and syncing across your linked devices, already works.`;
  for (const word of text.split(/(\s+)/)) {
    await new Promise((r) => setTimeout(r, 12));
    yield { type: "text", text: word };
  }
}
