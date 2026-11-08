// Antares Auto: picks which AI answers a chat message based on what kind of task it is.
// Rules are deliberately simple and readable; tune them as real usage data comes in.
import type { ProviderId } from "./providers";

export type Task = "long document" | "current events" | "coding" | "math" | "writing" | "humor" | "general";

type Rule = { task: Task; test: (text: string) => boolean; prefer: ProviderId[] };

const has = (re: RegExp) => (t: string) => re.test(t);

// First matching rule wins. Each list is tried in order, skipping providers without a key.
// Auto only routes to core (US-hosted) providers; DeepSeek and Kimi must be picked by hand.
const RULES: Rule[] = [
  // Gemini handles very long inputs well and at low cost.
  { task: "long document", test: (t) => t.length > 30_000, prefer: ["gemini", "claude", "openai"] },
  // Claude is the model wired to live web search here, so it gets anything time-sensitive.
  {
    task: "current events",
    test: has(/\b(today|tonight|latest|news|this (week|month|year)|right now|currently|price of|stock|score|weather|election|trending|recent(ly)?)\b/i),
    prefer: ["claude"],
  },
  {
    task: "coding",
    test: has(/```|\b(code|coding|function|bug|debug|error|stack ?trace|python|javascript|typescript|java|c\+\+|rust|golang|sql|regex|script|api|compile|refactor)\b/i),
    prefer: ["claude", "openai"],
  },
  {
    task: "math",
    test: has(/\b(calculate|compute|solve|equation|integral|derivative|probability|percent(age)?|interest|mortgage|loan|statistics|proof)\b|\d\s*[-+*/^%]\s*\d/i),
    prefer: ["openai", "claude", "gemini"],
  },
  {
    task: "writing",
    test: has(/\b(write|rewrite|edit|proofread|essay|email|letter|story|poem|caption|tone|summari[sz]e|draft)\b/i),
    prefer: ["claude", "openai", "gemini"],
  },
  { task: "humor", test: has(/\b(joke|funny|roast|meme|banter)\b/i), prefer: ["grok", "claude"] },
];

const GENERAL: ProviderId[] = ["claude", "openai", "gemini", "grok"];

export function routeTask(text: string): { task: Task; prefer: ProviderId[] } {
  const rule = RULES.find((r) => r.test(text));
  return rule ? { task: rule.task, prefer: [...rule.prefer, ...GENERAL] } : { task: "general", prefer: GENERAL };
}
