// Rehua Shield: checks a message, email, or link someone received for scams and threats.
//
// Guardrails (from the Rehua/Antares overview):
// - Opt-in only. Shield looks at what the user pastes in, nothing else. It never reads
//   inboxes, texts, or other private messages on its own.
// - Nothing pasted into Shield is stored. The text goes to the AI model for the check and
//   is then discarded; only the usual one-message usage count is recorded.
// - Shield never files a report. It prepares a summary the user can copy, and links to the
//   official FTC and FBI IC3 forms, where the user files it themselves.
import Anthropic from "@anthropic-ai/sdk";
import { askCompatible, availableProviders, providerInfo, type ProviderId } from "./providers";

export type ThreatLevel = "low" | "medium" | "high";

export type UrlVerdict = {
  url: string;
  domain: string;
  /** Threat types from Google Web Risk, when WEB_RISK_API_KEY is set. Empty means none found. */
  threats: string[];
  /** False when no URL reputation service is configured, so the check didn't run. */
  checked: boolean;
};

export type ShieldResult = {
  level: ThreatLevel;
  type: string;
  verdict: string;
  signs: string[];
  steps: string[];
  /** Where to report it in the US, or "" when it looks legitimate. */
  report: string;
  urls: UrlVerdict[];
  /** "ai" when a model made the call; "basic" when only the built-in rules ran. */
  engine: "ai" | "basic";
  modelName?: string;
};

export const MAX_SCAN_CHARS = 8000;

const SHIELD_PROMPT = `You are Rehua Shield, a fraud and threat analyst protecting an ordinary person.
Analyze the content the user received or found. Judge how likely it is to be a scam, phishing, fraud, hacking attempt,
impersonation, or a threat to their safety. Base the verdict on concrete evidence in the content (sender claims, links and
their real domains, urgency, payment requests, requests for codes or personal data, grammar, mismatches).
You also get automated pre-check findings and URL reputation results; weigh them, but they can be wrong.
If it looks legitimate, say so plainly and rate it low. Keep every string short.
Never ask the user for passwords, codes, or account numbers.
Reply with only one JSON object of this shape and nothing else:
{"level":"low"|"medium"|"high","type":"2-5 word name of the threat or 'Looks legitimate'","verdict":"one plain sentence",
"signs":["2-4 short signs found in the content"],"steps":["2-4 short protective steps in order"],
"report":"where to report it in the US (FTC reportfraud.ftc.gov, FBI ic3.gov, the impersonated company, or 911), or empty string"}`;

// ---------- Built-in pre-check ----------

// Brands scammers impersonate most, mapped to the domains they really use.
const BRANDS: Record<string, string[]> = {
  usps: ["usps.com"],
  ups: ["ups.com"],
  fedex: ["fedex.com"],
  dhl: ["dhl.com"],
  amazon: ["amazon.com"],
  paypal: ["paypal.com"],
  apple: ["apple.com", "icloud.com"],
  microsoft: ["microsoft.com", "live.com", "office.com"],
  netflix: ["netflix.com"],
  irs: ["irs.gov"],
  chase: ["chase.com"],
  wellsfargo: ["wellsfargo.com"],
  bankofamerica: ["bankofamerica.com"],
  coinbase: ["coinbase.com"],
  venmo: ["venmo.com"],
  zelle: ["zellepay.com"],
};

const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "ow.ly", "rb.gy", "cutt.ly", "shorturl.at"];
const RISKY_TLDS = ["zip", "mov", "top", "xyz", "click", "live", "icu", "buzz", "cam", "rest", "support", "help"];

const PATTERNS: { re: RegExp; sign: string; weight: number }[] = [
  { re: /\b(within|in) \d+ (hours?|minutes?)\b|\burgent(ly)?\b|\bimmediately\b|\bfinal (notice|warning)\b|\bact now\b/i, sign: "Pressure to act fast", weight: 2 },
  { re: /\bgift ?cards?\b|\bwire (transfer|the money)\b|\bbitcoin\b|\bcrypto(currency)?\b|\bzelle\b|\bcash ?app\b/i, sign: "Asks for payment that's hard to reverse", weight: 3 },
  { re: /\b(verification|security|one[- ]time|login) code\b|\bOTP\b|\bpassword\b|\bPIN\b/i, sign: "Mentions codes or passwords", weight: 3 },
  { re: /\b(social security|SSN|bank account|routing number|card number|CVV)\b/i, sign: "Asks about sensitive personal or financial details", weight: 3 },
  { re: /\b(suspended|locked|unusual (sign-?in|activity)|verify your (account|identity))\b/i, sign: "Claims your account has a problem", weight: 2 },
  { re: /\b(you('ve| have)? won|prize|lottery|sweepstakes|inheritance)\b/i, sign: "Promises a prize or windfall", weight: 2 },
  { re: /\b(package|parcel|delivery).{0,40}\b(hold|failed|missed|incomplete|redeliver)/i, sign: "Delivery-problem story, a common text scam", weight: 2 },
  { re: /\b(don'?t tell|keep this (between us|secret))\b/i, sign: "Asks you to keep it secret", weight: 3 },
];

export function extractUrls(text: string): string[] {
  const found = text.match(/\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi) ?? [];
  const urls = found.map((u) => u.replace(/[.,;:!?]+$/, "")).map((u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`));
  return [...new Set(urls)].slice(0, 10);
}

export function domainOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

const isOrUnder = (domain: string, root: string) => domain === root || domain.endsWith(`.${root}`);

/** Rule-based signals. Cheap, offline, and deliberately conservative; the AI makes the final call. */
export function preCheck(text: string) {
  const signs: string[] = [];
  let score = 0;
  for (const p of PATTERNS) {
    if (p.re.test(text)) {
      signs.push(p.sign);
      score += p.weight;
    }
  }
  for (const url of extractUrls(text)) {
    const domain = domainOf(url);
    if (!domain) continue;
    // Match whole name parts ("usps-redelivery" or "appleid"), not any substring, so
    // groups.google.com doesn't count as "ups" or purchase.com as "chase".
    const parts = domain.split(/[-.]/);
    for (const [brand, real] of Object.entries(BRANDS)) {
      const named = parts.some((p) => p === brand || (brand.length >= 4 && p.startsWith(brand)));
      if (named && !real.some((r) => isOrUnder(domain, r))) {
        signs.push(`Link uses "${brand}" in its name but isn't on ${real[0]} (${domain})`);
        score += 4;
        break;
      }
    }
    if (SHORTENERS.some((s) => isOrUnder(domain, s))) {
      signs.push(`Shortened link hides where it goes (${domain})`);
      score += 1;
    }
    if (RISKY_TLDS.includes(domain.split(".").pop() ?? "")) {
      signs.push(`Link ends in a domain type often used for scams (${domain})`);
      score += 1;
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) {
      signs.push("Link points to a bare IP address");
      score += 2;
    }
    if (url.startsWith("http://")) {
      signs.push(`Link isn't encrypted (${domain})`);
      score += 1;
    }
  }
  const level: ThreatLevel = score >= 6 ? "high" : score >= 3 ? "medium" : "low";
  return { signs: [...new Set(signs)], score, level };
}

// ---------- URL reputation (Google Web Risk) ----------

/**
 * Checks links against Google Web Risk when WEB_RISK_API_KEY is set. Web Risk is Google's
 * commercial-use version of Safe Browsing (the free Safe Browsing API is non-commercial only).
 */
export async function checkUrls(urls: string[]): Promise<UrlVerdict[]> {
  const key = process.env.WEB_RISK_API_KEY;
  return Promise.all(
    urls.map(async (url): Promise<UrlVerdict> => {
      const base = { url, domain: domainOf(url) };
      if (!key) return { ...base, threats: [], checked: false };
      try {
        const q = new URLSearchParams({ uri: url, key });
        for (const t of ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"]) q.append("threatTypes", t);
        const res = await fetch(`https://webrisk.googleapis.com/v1/uris:search?${q}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`Web Risk ${res.status}`);
        const data = (await res.json()) as { threat?: { threatTypes?: string[] } };
        return { ...base, threats: data.threat?.threatTypes ?? [], checked: true };
      } catch (err) {
        console.error("Web Risk lookup failed", err);
        return { ...base, threats: [], checked: false };
      }
    }),
  );
}

const THREAT_NAMES: Record<string, string> = {
  MALWARE: "malware",
  SOCIAL_ENGINEERING: "phishing",
  UNWANTED_SOFTWARE: "unwanted software",
};

// ---------- The scan ----------

function parseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("The model didn't return JSON");
  }
}

const strings = (v: unknown, max: number) =>
  Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean).slice(0, max) : [];

const LEVELS: ThreatLevel[] = ["low", "medium", "high"];
const higher = (a: ThreatLevel, b: ThreatLevel) => (LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b);

/** Which model runs Shield: Claude when configured, otherwise the first connected provider. */
function shieldModel(): { id: ProviderId; name: string; model: string } | null {
  if (process.env.ANTHROPIC_API_KEY) {
    const c = providerInfo("claude");
    return { id: "claude", name: c.name, model: process.env.SHIELD_MODEL || c.model };
  }
  const other = availableProviders().find((p) => p.id !== "claude");
  return other ? { id: other.id, name: other.name, model: other.model } : null;
}

async function askModel(id: ProviderId, model: string, prompt: string) {
  if (id === "claude") {
    const msg = await new Anthropic().messages.create({
      model,
      max_tokens: 1024,
      system: SHIELD_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });
    return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  }
  return askCompatible(id as Exclude<ProviderId, "claude">, SHIELD_PROMPT, prompt);
}

const DEFAULT_STEPS: Record<ThreatLevel, string[]> = {
  high: [
    "Don't click links, call numbers, or reply",
    "Contact the company using its official website or app",
    "If you already paid or shared details, call your bank now",
  ],
  medium: ["Don't act on it yet", "Check with the sender through a channel you already trust"],
  low: ["No action needed, but never share passwords or codes"],
};

export async function runShieldScan(content: string): Promise<ShieldResult> {
  const pre = preCheck(content);
  const urls = await checkUrls(extractUrls(content));
  const flagged = urls.filter((u) => u.threats.length);
  const urlSigns = flagged.map(
    (u) => `Google Web Risk lists ${u.domain} for ${u.threats.map((t) => THREAT_NAMES[t] ?? t).join(", ")}`,
  );
  // A link on a known-bad list is a hard signal, so the model can't rate below high. Strong
  // rule-based signs (like a fake brand domain) keep the result at caution or above.
  const floor: ThreatLevel = flagged.length ? "high" : pre.level === "high" ? "medium" : "low";

  const target = shieldModel();
  if (target) {
    const prompt = [
      `Content to analyze:\n"""\n${content}\n"""`,
      `Automated pre-check findings: ${pre.signs.length ? pre.signs.join("; ") : "none"}`,
      `URL reputation: ${
        urls.length
          ? urls.map((u) => `${u.domain}: ${u.checked ? u.threats.join(", ") || "no known threats" : "not checked"}`).join("; ")
          : "no links"
      }`,
    ].join("\n\n");
    try {
      const r = parseJson(await askModel(target.id, target.model, prompt));
      const raw = String(r.level ?? "").toLowerCase() as ThreatLevel;
      const level = higher(LEVELS.includes(raw) ? raw : "medium", floor);
      return {
        level,
        type: String(r.type || "Unclear").slice(0, 60),
        verdict: String(r.verdict || "").slice(0, 300),
        signs: [...urlSigns, ...strings(r.signs, 4)].slice(0, 5),
        steps: strings(r.steps, 4).length ? strings(r.steps, 4) : DEFAULT_STEPS[level],
        report: level === "low" ? "" : String(r.report || "").slice(0, 300),
        urls,
        engine: "ai",
        modelName: target.name,
      };
    } catch (err) {
      console.error("Shield AI check failed; returning the built-in check", err);
    }
  }

  // No model configured, or the model call failed: report the rule-based result, labeled as such.
  const level = higher(pre.level, floor);
  return {
    level,
    type: level === "low" ? "No clear warning signs" : "Possible scam",
    verdict:
      level === "low"
        ? "The basic check found no common scam signs. That doesn't prove it's safe."
        : "The basic check found common scam signs. Treat it with caution.",
    signs: [...urlSigns, ...pre.signs].slice(0, 5),
    steps: DEFAULT_STEPS[level],
    report: level === "high" ? "FTC: reportfraud.ftc.gov · FBI: ic3.gov" : "",
    urls,
    engine: "basic",
  };
}
