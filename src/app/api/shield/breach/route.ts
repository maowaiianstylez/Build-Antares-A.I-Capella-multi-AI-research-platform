import { currentUser } from "@/lib/auth";
import { tooManyAttempts } from "@/lib/rate-limit";

type Breach = {
  name: string;
  title: string;
  domain: string;
  breachDate: string;
  dataClasses: string[];
  verified: boolean;
};

/** GET -> { available }: whether breach checks are switched on for this server. */
export async function GET() {
  return Response.json({ available: Boolean(process.env.HIBP_API_KEY) });
}

/**
 * POST { consent: true } -> { email, breaches: Breach[] }
 * Looks up the signed-in user's OWN account email in Have I Been Pwned (a licensed breach
 * database). It never accepts an arbitrary address, so it can't be used to look people up.
 * It runs only when the user asks, and nothing about the result is stored.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Please sign in to check for breaches." }, { status: 401 });

  const key = process.env.HIBP_API_KEY;
  if (!key) return Response.json({ error: "Breach checks aren't switched on yet." }, { status: 503 });

  const body = await request.json().catch(() => null);
  if (body?.consent !== true) {
    return Response.json({ error: "Confirm that you want to check your email first." }, { status: 400 });
  }
  if (await tooManyAttempts(`hibp:${user.id}`, 5, 60 * 60 * 1000)) {
    return Response.json({ error: "You've checked a few times already. Try again in an hour." }, { status: 429 });
  }

  const res = await fetch(
    `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(user.email)}?truncateResponse=false`,
    {
      headers: { "hibp-api-key": key, "user-agent": "RehuaShield/1.0" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    },
  ).catch((err) => {
    console.error("HIBP request failed", err);
    return null;
  });

  if (res?.status === 404) return Response.json({ email: user.email, breaches: [] });
  if (!res?.ok) {
    if (res) console.error("HIBP returned", res.status);
    return Response.json({ error: "The breach service didn't answer. Try again in a minute." }, { status: 502 });
  }

  const raw = (await res.json()) as {
    Name: string;
    Title: string;
    Domain: string;
    BreachDate: string;
    DataClasses: string[];
    IsVerified: boolean;
  }[];
  const breaches: Breach[] = raw
    .map((b) => ({
      name: b.Name,
      title: b.Title,
      domain: b.Domain,
      breachDate: b.BreachDate,
      dataClasses: b.DataClasses ?? [],
      verified: b.IsVerified,
    }))
    .sort((a, b) => b.breachDate.localeCompare(a.breachDate));
  return Response.json({ email: user.email, breaches });
}
