# Rehua A.I Capella

A deep research and results platform for everyday people. Rehua asks every major AI (Claude, ChatGPT, Gemini, Grok, DeepSeek) your question, cross-checks their answers against real web sources and each other, and gives you one sourced answer. Conversations sync across your home system, phone, tablet, computer, and vehicle.

## What works today (MVP)

- **Website** (`/`): landing page covering capabilities, device sync, and Rehua Shield.
- **Chat app** (`/chat`): streaming answers, Markdown and code rendering, conversation history.
- **Deep Dive** (Pro and Max, counts as 5 messages): (1) Claude searches the web and writes a neutral evidence brief; (2) every connected model answers independently from that evidence, in parallel; (3) Claude cross-checks the panel against the sources and writes the final answer: bottom line, cited evidence, where models agree and differ, confidence. Each model's answer is shown in a collapsible panel. A model that fails or times out is skipped, not fatal.
- **Model picker**: chat with Claude, ChatGPT, Gemini, Grok, DeepSeek, or Kimi, or "Rehua Auto", which routes each message by task type. Only providers with a key appear.
- **Cross-device sync**: "Link another device" shows a 6-character code / link. Every linked device shares the same conversations, and a reply that is still being written shows up live on the others. If the asking device disconnects mid-answer, the server keeps generating and saves the reply.
- **Accounts**: email + password sign-up and sign-in (scrypt-hashed passwords, HttpOnly session cookies, attempt limits). Signing in on any device joins your conversations. A one-time 6-character code signs in a phone or car without typing a password.
- **Plans**: Free (25 messages/day), Pro $19.99/mo (500/day + deep research), Max $49.99/mo (2,000/day + early access). Defined in `src/lib/plans.ts` and enforced on the server.
- **Stripe payments**: Checkout for subscriptions, the Stripe customer portal for card changes and cancellation, and a signed webhook that turns plans on and off.
- **Voice**: tap the mic to ask out loud, "Read aloud" speaks answers, and "Hands-free" loops listen → answer → speak → listen for home and car use. Uses the browser's built-in speech engines (Chrome, Edge, Safari), so no extra service or key.
- **Installable app**: a web app manifest and icons let people install Rehua on phones, tablets, computers and car screens ("Install the Rehua app" in the chat sidebar, or Add to Home Screen on iPhone).
- **Password reset**: "Forgot password?" emails a one-hour, single-use link through Resend (`RESEND_API_KEY`, `EMAIL_FROM`). Resetting signs the account out everywhere. Without email keys the link is printed to the server log.
- **Demo mode**: runs without an AI key so the site and sync can be tried immediately.

## Run it

You need Node 20+ and a Postgres database (local, Docker, or a free hosted one such as Neon).

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL; add ANTHROPIC_API_KEY for live answers
npm run dev                  # http://localhost:3000
```

Tables are created automatically the first time the app talks to the database.

## Deploy (Railway, recommended)

Railway runs the app and its Postgres database side by side, with no time limit on long Deep Dives.

1. Put this code in a GitHub repository.
2. Sign in at [railway.com](https://railway.com) with GitHub, choose **New Project → Deploy from GitHub repo**, and pick the repository. `railway.json` already sets the build, start, and health check.
3. In the project, click **+ New → Database → PostgreSQL**.
4. Open the app service's **Variables** and add `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`, plus your AI, Stripe, and email keys from `.env.example`.
5. Under **Settings → Networking**, generate a public domain (or add your own), then set `APP_URL` to it.
6. In Stripe, point the webhook at `https://<your-domain>/api/stripe/webhook`.

`GET /api/health` returns `{ "ok": true }` when the app and database are up. Any other Node host with Postgres (Render, Fly.io, a VPS) works the same way: `npm run build`, then `npm start` with the variables set.

## Connecting AI providers

Add any of these keys; each provider is optional and is used only when its key is set.

| Provider | Key | Model override | Default model |
|---|---|---|---|
| Claude (Anthropic) | `ANTHROPIC_API_KEY` (required for Deep Dive) | `ANTARES_MODEL` | `claude-opus-5-5` |
| ChatGPT (OpenAI) | `OPENAI_API_KEY` | `OPENAI_MODEL` | `gpt-5.6-sol` |
| Gemini (Google) | `GEMINI_API_KEY` | `GEMINI_MODEL` | `gemini-3.1-pro-preview` |
| Grok (xAI) | `XAI_API_KEY` | `XAI_MODEL` | `grok-4.5` |
| DeepSeek (optional, data processed in China) | `DEEPSEEK_API_KEY` | `DEEPSEEK_MODEL` | `deepseek-v4-pro` |
| Kimi (Moonshot AI, optional, data processed in China) | `KIMI_API_KEY` | `KIMI_MODEL` | `kimi-k3.1-pro` |

**Deep Dive panel:** by default the core four (Claude, ChatGPT, Gemini, Grok) that have keys. DeepSeek and Kimi join only when listed in `DEEP_DIVE_PANEL`, e.g. `claude,openai,gemini,grok,deepseek,kimi`. They can always be picked by hand in chat, labeled with where data is processed.

**Rehua Auto routing** (`src/lib/router.ts`): first matching rule wins, skipping providers without a key, and Auto only routes to the core four.

| Task | Detected by | Goes to |
|---|---|---|
| Long document | message over 30,000 characters | Gemini, then Claude |
| Current events | words like today, latest, news, price of, score | Claude (it has live web search) |
| Coding | code blocks, language names, bug, error | Claude, then ChatGPT |
| Math and money | calculate, solve, percent, loan, arithmetic | ChatGPT, then Claude |
| Writing | write, rewrite, edit, email, summarize | Claude, then ChatGPT |
| Humor | joke, roast, meme | Grok, then Claude |
| Everything else | | Claude, ChatGPT, Gemini, Grok |

Providers rename models often. Check each provider's model list when you add a key and set the `*_MODEL` variable if the default has changed. ChatGPT, Gemini, Grok and DeepSeek are called through their OpenAI-compatible endpoints (`src/lib/providers.ts`).

## Turning on payments (Stripe)

1. Create a Stripe account and copy the **secret key** (start with test mode, `sk_test_...`) into `STRIPE_SECRET_KEY`.
2. In Stripe, add a webhook endpoint pointing at `https://<your-site>/api/stripe/webhook` with the events `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
   For local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
3. Redeploy, then open `/api/health`: `setup.stripe` should say `test` (or `live`) and `setup.stripeWebhook` should be `true`.
4. Test with card `4242 4242 4242 4242`, any future date, any CVC.

No products or portal settings need to be made in the Stripe dashboard. The first checkout creates one "Rehua A.I Capella Pro" and one "Max" product with monthly prices from `src/lib/plans.ts` (found again later by lookup key), and the first "Manage billing" click creates a customer portal configuration that allows card updates, invoices, cancelling at period end, and switching between Pro and Max. Changing a price in `plans.ts` creates a new Stripe price for new checkouts; existing subscribers keep their old price.

Optional overrides: `STRIPE_PRICE_PRO` / `STRIPE_PRICE_MAX` to use prices you made in the dashboard, and `STRIPE_PORTAL_CONFIGURATION` to use your own portal configuration.

To use every feature yourself without paying, set `OWNER_EMAILS` to your account's email (comma-separate several). Those accounts are always treated as Max. Sign up with that email before setting it, since emails aren't verified yet.

## Admin dashboard

`/admin` shows every account with its plan, subscription status, messages today and all time, last activity, and sign-up date, plus totals (accounts, paying users, monthly revenue, messages today). From there an admin can suspend an account, which signs it out on every device and blocks sign-in, or unsuspend it. Suspending doesn't cancel a Stripe subscription.

Admins are the accounts whose emails are in `ADMIN_EMAILS` (comma-separated). Emails in `OWNER_EMAILS` are admins too. As with `OWNER_EMAILS`, sign up with the email before adding it. Admins can't suspend themselves or each other. An "Admin dashboard" button appears on the account page for admins; everyone else gets a 404 at `/admin` and `/api/admin/*`.

The email lists are forgiving: commas, semicolons, spaces or new lines all work as separators, and quotes or capital letters don't matter. Railway only applies a variable change after you press **Deploy** on the banner it shows, so the app needs a redeploy before a new admin takes effect. `/api/health` reports how many admin and owner emails the running app sees (counts only, never the addresses).

### Owner password reset without email

Until Resend is set up, "Forgot password?" can't send email (the link only goes to the server log). For the owner, set `OWNER_RESET_CODE` to a long private code (12+ characters). Then open `/owner-reset`, enter an email that's in `ADMIN_EMAILS` or `OWNER_EMAILS` plus that code, and you'll be taken to the normal "choose a new password" page. It's off when `OWNER_RESET_CODE` isn't set, it only works for admin emails, and it allows 5 tries per 15 minutes. Remove the variable once email works if you like.

## Rehua Shield

`/shield` (also in the site header) is the consumer safety tool from the original Antares prototype, rebuilt on Rehua's accounts, plans, and AI providers. It has three parts:

- **Scan a message** (signed in, counts as 1 message): paste a text, email, or link. Rehua's built-in rules look for common scam signs (lookalike brand domains like `usps-redelivery-help.co`, pressure to act fast, gift card or crypto payment, requests for codes), links are checked against Google Web Risk if `WEB_RISK_API_KEY` is set, and then the AI (Claude, or the first connected provider; override the model with `SHIELD_MODEL`) gives a risk level (low, caution, high), the warning signs, and steps to take. A link on Web Risk's list always rates high. If no AI key is set, or the AI call fails, the result is labeled as a basic rules-only check.
- **Alerts** (anyone): the latest FTC Consumer Alerts and CISA advisories, cached and refreshed every 15 minutes. Both are US government feeds, so they are public domain and fine for a paid app.
- **Breach check**: "Is your email in a data breach?" looks up only the signed-in user's own account email in Have I Been Pwned, only after they tick a consent box, 5 checks an hour. It is off until `HIBP_API_KEY` is set. "Has a password been leaked?" uses HIBP's free Pwned Passwords range API from the browser: only the first 5 characters of the password's SHA-1 hash leave the device, and Rehua's server never sees it.

Guardrails, following the Antares overview: Shield is opt-in and only sees what the user gives it. It never reads email, texts, or other private messages. Pasted content isn't stored. It never files a report: for risky results it links to the FTC and FBI IC3 forms and can prepare a summary for the user to review, copy, and submit themselves.

| Variable | What it turns on | Cost (checked Nov 2026) |
|---|---|---|
| `WEB_RISK_API_KEY` | Link reputation check (Google Cloud Web Risk API, Lookup) | First 100,000 lookups a month free, then $0.50 per 1,000 |
| `HIBP_API_KEY` | Email breach check (haveibeenpwned.com/API/Key) | From $4.39 a month (Core 1, billed yearly, 10 lookups a minute) |
| `SHIELD_MODEL` | Optional model override for Claude scans | Uses the normal Claude API pricing |

Before relying on the email breach check at scale, add email verification (sign-up doesn't verify emails yet), so people can only look up addresses they own.

## Layout

| Path | What it is |
|---|---|
| `src/app/page.tsx` | Marketing site |
| `src/components/ChatApp.tsx` | Chat UI, polling sync, device-link dialog |
| `src/app/api/chat/route.ts` | Streams replies (NDJSON) and mirrors them into storage for other devices |
| `src/lib/antares.ts` | Rehua engine: single-model chat, the Deep Dive pipeline, demo mode |
| `src/lib/providers.ts` | Provider registry and calls for ChatGPT, Gemini, Grok, DeepSeek |
| `src/lib/db.ts` | Postgres connection and schema (created automatically) |
| `src/lib/store.ts` | Conversations and messages |
| `src/lib/auth.ts` | Accounts, sessions, daily usage, device sign-in codes |
| `src/lib/plans.ts` | Plan names, prices, and limits |
| `src/lib/billing.ts`, `src/app/api/billing/*`, `src/app/api/stripe/webhook` | Stripe checkout, portal, webhook |
| `src/app/pricing`, `src/app/account`, `src/app/signin`, `src/app/signup` | Pricing, account, and auth pages |
| `src/app/admin`, `src/lib/admin.ts`, `src/app/api/admin/*` | Owner/admin dashboard and account suspension |
| `src/app/shield`, `src/components/ShieldPanel.tsx`, `src/lib/shield.ts`, `src/lib/alerts.ts`, `src/app/api/shield/*` | Rehua Shield: scam scan, official alerts, breach checks |

## Before production

- Email verification, and optionally Google/Apple sign-in.
- Replace polling with WebSockets/SSE for lower handoff latency.
- Native mobile and car apps (CarPlay / Android Auto).
- Rehua Shield next steps: opt-in breach monitoring with alerts (needs stored consent and a scheduled job), and a threat check inside chat when someone pastes a link.
- Video creation pipeline.
