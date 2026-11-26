import { cacheLife } from "next/cache";
import { connection } from "next/server";
import { loadAlerts } from "@/lib/alerts";

// Cached for everyone and refreshed in the background every 15 minutes, so the agencies'
// feeds see a few requests an hour no matter how many people open Shield.
async function cachedAlerts() {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  return { feeds: await loadAlerts(), fetchedAt: Date.now() };
}

/** GET -> { feeds: [{ id, label, source, url, items: [{ title, link, summary, source, time }], error }], fetchedAt } */
export async function GET() {
  // Fetch at request time, not during the build, so a build without network access
  // doesn't bake "feed unavailable" into the deployed app.
  await connection();
  return Response.json(await cachedAlerts());
}
