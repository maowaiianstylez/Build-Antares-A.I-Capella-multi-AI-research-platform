// Official scam and security alerts for the Shield page.
// Both feeds come from US government agencies, so their text is public domain and fine to
// show in a paid app (unlike most news feeds, which are licensed for personal use only).

export type AlertItem = {
  title: string;
  link: string;
  summary: string;
  source: string;
  /** Milliseconds since epoch, or null when the feed's date couldn't be read. */
  time: number | null;
};

export type AlertFeed = { id: "scams" | "security"; label: string; source: string; url: string };

export const ALERT_FEEDS: AlertFeed[] = [
  { id: "scams", label: "Scam alerts", source: "FTC Consumer Alerts", url: "https://consumer.ftc.gov/blog/gd-rss.xml" },
  { id: "security", label: "Security advisories", source: "CISA", url: "https://www.cisa.gov/cybersecurity-advisories/all.xml" },
];

const ENTITIES: Record<string, string> = { quot: '"', apos: "'", lt: "<", gt: ">", amp: "&", nbsp: " " };

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(quot|apos|lt|gt|nbsp|amp);/g, (_, e) => ENTITIES[e]);

/** Strips markup and collapses whitespace. Descriptions are entity-encoded HTML, so decode twice. */
const plain = (s: string) =>
  decode(decode(s).replace(/<[^>]*>/g, " "))
    .replace(/<[^>]*>/g, " ")
    .replace(/^By BCP Staff\s*/i, "")
    .replace(/\s*Read more\s*>?\s*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/ ([,.;:])/g, "$1")
    .trim();

/** RSS dates, plus the FTC's "November 19, 2026 | 9:40AM" style. */
export function parseFeedDate(raw: string): number | null {
  const s = raw.trim();
  const ftc = s.match(/^([A-Za-z]+ \d{1,2}, \d{4}) \| (\d{1,2}:\d{2})\s*([AP]M)$/i);
  const t = ftc ? Date.parse(`${ftc[1]} ${ftc[2]} ${ftc[3]} EST`) : Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

export function parseFeed(xml: string, source: string, limit = 8): AlertItem[] {
  const items: AlertItem[] = [];
  for (const [item] of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)) {
    const get = (tag: string) => item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? "";
    const title = plain(get("title"));
    const link = decode(get("link")).trim();
    if (!title || !/^https:\/\//.test(link)) continue;
    const summary = plain(get("description"));
    items.push({
      title,
      link,
      summary: summary.length > 240 ? `${summary.slice(0, 237).trimEnd()}…` : summary,
      source,
      time: parseFeedDate(decode(get("pubDate"))),
    });
  }
  return items.sort((a, b) => (b.time ?? 0) - (a.time ?? 0)).slice(0, limit);
}

/** Fetches every feed. A feed that fails comes back empty with an error note instead of breaking the page. */
export async function loadAlerts() {
  return Promise.all(
    ALERT_FEEDS.map(async (f) => {
      try {
        const res = await fetch(f.url, {
          headers: { "User-Agent": "RehuaShield/1.0 (+alerts reader)" },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { ...f, items: parseFeed(await res.text(), f.source), error: null as string | null };
      } catch (err) {
        console.error("Alert feed failed:", f.url, err);
        return { ...f, items: [] as AlertItem[], error: "This feed couldn't be loaded right now." };
      }
    }),
  );
}
