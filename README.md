# Antares A.I Capella

A deep research and results platform for everyday people. Antares asks every major AI (Claude, ChatGPT, Gemini, Grok, DeepSeek) your question, cross-checks their answers against real web sources and each other, and gives you one sourced answer. Conversations sync across your home system, phone, tablet, computer, and vehicle.

## What works today (MVP)

- **Website** (`/`): landing page covering capabilities, device sync, and Antares Shield.
- **Chat app** (`/chat`): streaming answers, Markdown and code rendering, conversation history.
- **Deep Dive** (Pro and Max, counts as 5 messages): (1) Claude searches the web and writes a neutral evidence brief; (2) every connected model answers independently from that evidence, in parallel; (3) Claude cross-checks the panel against the sources and writes the final answer: bottom line, cited evidence, where models agree and differ, confidence. Each model's answer is shown in a collapsible panel. A model that fails or times out is skipped, not fatal.
- **Model picker**: chat with Claude, ChatGPT, Gemini, Grok, or DeepSeek, or "Antares Auto". Only providers with a key appear.
- **Cross-device sync**: "Link another device" shows a 6-character code / link. Every linked device shares the same conversations, and a reply that is still being written shows up live on the others. If the asking device disconnects mid-answer, the server keeps generating and saves the reply.
- **Accounts**: email + password sign-up and sign-in (scrypt-hashed passwords, HttpOnly session cookies, attempt limits). Signing in on any device joins your conversations. A one-time 6-character code signs in a phone or car without typing a password.
- **Plans**: Free (25 messages/day), Pro $19.99/mo (500/day + deep research), Max $49.99/mo (2,000/day + early access). Defined in `src/lib/plans.ts` and enforced on the server.
- **Stripe payments**: Checkout for subscriptions, the Stripe customer portal for card changes and cancellation, and a signed webhook that turns plans on and off.
- **Demo mode**: runs without an AI key so the site and sync can be tried immediately.

## Run it

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY for live answers
npm run dev                  # http://localhost:3000
```

## Connecting AI providers

Add any of these keys; each provider is optional and is used only when its key is set.

| Provider | Key | Model override | Default model |
|---|---|---|---|
| Claude (Anthropic) | `ANTHROPIC_API_KEY` (required for Deep Dive) | `ANTARES_MODEL` | `claude-opus-5-5` |
| ChatGPT (OpenAI) | `OPENAI_API_KEY` | `OPENAI_MODEL` | `gpt-5.6-sol` |
| Gemini (Google) | `GEMINI_API_KEY` | `GEMINI_MODEL` | `gemini-3.1-pro-preview` |
| Grok (xAI) | `XAI_API_KEY` | `XAI_MODEL` | `grok-4.5` |
| DeepSeek | `DEEPSEEK_API_KEY` | `DEEPSEEK_MODEL` | `deepseek-v4-pro` |

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
| `src/lib/store.ts` | File-backed storage for conversations |
| `src/lib/auth.ts` | Accounts, sessions, daily usage, device sign-in codes |
| `src/lib/plans.ts` | Plan names, prices, and limits |
| `src/lib/billing.ts`, `src/app/api/billing/*`, `src/app/api/stripe/webhook` | Stripe checkout, portal, webhook |
| `src/app/pricing`, `src/app/account`, `src/app/signin`, `src/app/signup` | Pricing, account, and auth pages |

## Before production

- Replace the file store with a real database (Postgres); the file store only works on a single server.
- Add password reset and email verification (needs an email provider), and optionally Google/Apple sign-in.
- Replace polling with WebSockets/SSE for lower handoff latency.
- Move the sign-in attempt limiter to Redis once there is more than one server.
- Voice in/out for home and vehicle use; native mobile and car apps (CarPlay / Android Auto).
- Antares Shield: OAuth connectors (Gmail, Microsoft, social accounts) with per-account consent and revocation.
- Video creation pipeline.
