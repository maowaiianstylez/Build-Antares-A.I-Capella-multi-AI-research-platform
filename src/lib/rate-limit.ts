// Small in-memory limiter for sign-in and sign-up attempts. Per server instance;
// use Redis once Antares runs on more than one server.
const hits = new Map<string, number[]>();

export function tooManyAttempts(key: string, max = 10, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
