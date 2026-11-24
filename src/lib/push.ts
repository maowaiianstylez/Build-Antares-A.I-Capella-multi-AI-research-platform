// Push notifications for the iPhone, iPad and Android apps. Android goes through Firebase Cloud
// Messaging (FCM); iPhone and iPad go straight to Apple's push service (APNs). Each side turns on
// when its keys are set, and without keys nothing is sent and nothing breaks.
//
//   Android:  FIREBASE_SERVICE_ACCOUNT  the Firebase service account JSON (one line)
//   iOS:      APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY (contents of the .p8 file),
//             APNS_BUNDLE_ID (defaults to ai.rehua.app), APNS_PRODUCTION=true for App Store builds
import crypto from "crypto";
import http2 from "http2";
import { db } from "./db";

export const APP_BUNDLE_ID = process.env.APNS_BUNDLE_ID || "ai.rehua.app";

const b64url = (data: Buffer | string) => Buffer.from(data).toString("base64url");
const pem = (key: string) => key.replace(/\\n/g, "\n");

export function pushStatus() {
  return {
    android: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
    ios: Boolean(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY),
  };
}

export async function savePushToken(userId: string, token: string, platform: string) {
  const sql = await db();
  await sql`insert into push_tokens (token, user_id, platform) values (${token}, ${userId}, ${platform})
            on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now()`;
}

export async function removePushToken(userId: string, token: string) {
  const sql = await db();
  await sql`delete from push_tokens where token = ${token} and user_id = ${userId}`;
}

// ---- Android (FCM HTTP v1) ----

let fcmToken: { value: string; expires: number } | null = null;

async function fcmAccessToken(account: { client_email: string; private_key: string }) {
  if (fcmToken && fcmToken.expires > Date.now() + 60_000) return fcmToken.value;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${claims}`), pem(account.private_key));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(signature)}`,
    }),
  });
  if (!res.ok) throw new Error(`Firebase sign-in failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  fcmToken = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return fcmToken.value;
}

/** Returns false when the token is no longer valid (app uninstalled), so it can be removed. */
async function sendAndroid(token: string, title: string, body: string, url: string) {
  const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await fcmAccessToken(account)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { token, notification: { title, body }, data: { url } } }),
  });
  if (res.status === 404 || res.status === 400) return false;
  if (!res.ok) console.error("FCM send failed", res.status, await res.text().catch(() => ""));
  return true;
}

// ---- iPhone and iPad (APNs) ----

let apnsJwt: { value: string; issued: number } | null = null;

function apnsAuthToken() {
  // Apple wants the token refreshed between 20 and 60 minutes.
  if (apnsJwt && Date.now() - apnsJwt.issued < 40 * 60_000) return apnsJwt.value;
  const header = b64url(JSON.stringify({ alg: "ES256", kid: process.env.APNS_KEY_ID }));
  const claims = b64url(JSON.stringify({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }));
  const signature = crypto.sign("sha256", Buffer.from(`${header}.${claims}`), {
    key: pem(process.env.APNS_PRIVATE_KEY!),
    dsaEncoding: "ieee-p1363",
  });
  apnsJwt = { value: `${header}.${claims}.${b64url(signature)}`, issued: Date.now() };
  return apnsJwt.value;
}

function sendIos(token: string, title: string, body: string, url: string): Promise<boolean> {
  const host = process.env.APNS_PRODUCTION === "true" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
  return new Promise((resolve) => {
    const client = http2.connect(host);
    client.on("error", (err) => {
      console.error("APNs connection failed", err);
      resolve(true);
    });
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${apnsAuthToken()}`,
      "apns-topic": APP_BUNDLE_ID,
      "apns-push-type": "alert",
    });
    let status = 0;
    req.on("response", (headers) => {
      status = Number(headers[":status"]);
    });
    req.on("data", () => {});
    req.on("end", () => {
      client.close();
      if (status !== 200 && status !== 410 && status !== 400) console.error("APNs send failed", status);
      resolve(status !== 410 && status !== 400);
    });
    req.end(JSON.stringify({ aps: { alert: { title, body }, sound: "default" }, url }));
  });
}

/** Notifies every app install signed into this account. Never throws. */
export async function notifyUser(userId: string, title: string, body: string, url = "/chat") {
  const status = pushStatus();
  if (!status.android && !status.ios) return;
  try {
    const sql = await db();
    const tokens = await sql<{ token: string; platform: string }[]>`
      select token, platform from push_tokens where user_id = ${userId}`;
    await Promise.all(
      tokens.map(async ({ token, platform }) => {
        let valid = true;
        if (platform === "android" && status.android) valid = await sendAndroid(token, title, body, url);
        if (platform === "ios" && status.ios) valid = await sendIos(token, title, body, url);
        if (!valid) await sql`delete from push_tokens where token = ${token}`;
      }),
    );
  } catch (err) {
    console.error("Push notification failed", err);
  }
}
