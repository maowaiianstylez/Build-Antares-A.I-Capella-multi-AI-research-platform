# Antares A.I Capella

A deep research and results platform for everyday people. Antares asks every major AI (Claude, ChatGPT, Gemini, Grok, DeepSeek) your question, cross-checks their answers against real web sources and each other, and gives you one sourced answer. Conversations sync across your home system, phone, tablet, computer, and vehicle.

## What works today (MVP)

- **Website** (`/`): landing page covering capabilities, device sync, and Antares Shield.
- **Chat app** (`/chat`): streaming answers, Markdown and code rendering, conversation history.
- **Deep Dive** (Pro and Max, counts as 5 messages): (1) Claude searches the web and writes a neutral evidence brief; (2) every connected model answers independently from that evidence, in parallel; (3) Claude cross-checks the panel against the sources and writes the final answer: bottom line, cited evidence, where models agree and differ, confidence. Each model's answer is shown in a collapsible panel. A model that fails or times out is skipped, not fatal.
- **Model picker**: chat with Claude, ChatGPT, Gemini, Grok, DeepSeek, or Kimi, or "Antares Auto", which routes each message by task type. Only providers with a key appear.
- **Cross-device sync**: "Link another device" shows a 6-character code / link. Every linked device shares the same conversations, and a reply that is still being written shows up live on the others. If the asking device disconnects mid-answer, the server keeps generating and saves the reply.
- **Accounts**: email + password sign-up and sign-in (scrypt-hashed passwords, HttpOnly session cookies, attempt limits). Signing in on any device joins your conversations. A one-time 6-character code signs in a phone or car without typing a password.
- **Plans**: Free (25 messages/day), Pro $19.99/mo (500/day + deep research), Max $49.99/mo (2,000/day + early access). Defined in `src/lib/plans.ts` and enforced on the server.
- **Stripe payments**: Checkout for subscriptions, the Stripe customer portal for card changes and cancellation, and a signed webhook that turns plans on and off.
- **Voice**: tap the mic to ask out loud, "Read aloud" speaks answers, and "Hands-free" loops listen → answer → speak → listen for home and car use. Uses the browser's built-in speech engines (Chrome, Edge, Safari), so no extra service or key.
- **Installable app**: a web app manifest and icons let people install Antares on phones, tablets, computers and car screens ("Install the Antares app" in the chat sidebar, or Add to Home Screen on iPhone).
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

**Antares Auto routing** (`src/lib/router.ts`): first matching rule wins, skipping providers without a key, and Auto only routes to the core four.

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
3. In Stripe's Billing settings, turn on the **customer portal** so "Manage billing" works.
4. Test with card `4242 4242 4242 4242`, any future date, any CVC.

Prices are created on the fly from `src/lib/plans.ts`, so no products need to be set up in Stripe first.

## Layout

| Path | What it is |
|---|---|
| `src/app/page.tsx` | Marketing site |
| `src/components/ChatApp.tsx` | Chat UI, polling sync, device-link dialog |
| `src/app/api/chat/route.ts` | Streams replies (NDJSON) and mirrors them into storage for other devices |
| `src/lib/antares.ts` | Antares engine: single-model chat, the Deep Dive pipeline, demo mode |
| `src/lib/providers.ts` | Provider registry and calls for ChatGPT, Gemini, Grok, DeepSeek |
| `src/lib/db.ts` | Postgres connection and schema (created automatically) |
| `src/lib/store.ts` | Conversations and messages |
| `src/lib/auth.ts` | Accounts, sessions, daily usage, device sign-in codes |
| `src/lib/plans.ts` | Plan names, prices, and limits |
| `src/lib/billing.ts`, `src/app/api/billing/*`, `src/app/api/stripe/webhook` | Stripe checkout, portal, webhook |
| `src/app/pricing`, `src/app/account`, `src/app/signin`, `src/app/signup` | Pricing, account, and auth pages |

## Before production

- Email verification, and optionally Google/Apple sign-in.
- Replace polling with WebSockets/SSE for lower handoff latency.
- Native mobile and car apps (CarPlay / Android Auto).
- Antares Shield: OAuth connectors (Gmail, Microsoft, social accounts) with per-account consent and revocation.
- Video creation pipeline.
