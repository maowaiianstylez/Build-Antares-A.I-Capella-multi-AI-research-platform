# Antares A.I Capella

The civilian edition of Antares A.I: a website plus a chat assistant that keeps one live conversation across every device you link (home system, phone, tablet, computer, vehicle).

## What works today (MVP)

- **Website** (`/`): landing page covering capabilities, device sync, and Antares Shield.
- **Chat app** (`/chat`): streaming answers, Markdown and code rendering, conversation history.
- **Deep research mode**: Antares searches the web and shows the sources it used as clickable citations.
- **Cross-device sync**: "Link another device" shows a 6-character code / link. Every linked device shares the same conversations, and a reply that is still being written shows up live on the others. If the asking device disconnects mid-answer, the server keeps generating and saves the reply.
- **Demo mode**: runs without an AI key so the site and sync can be tried immediately.

## Run it

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY for live answers
npm run dev                  # http://localhost:3000
```

## Layout

| Path | What it is |
|---|---|
| `src/app/page.tsx` | Marketing site |
| `src/components/ChatApp.tsx` | Chat UI, polling sync, device-link dialog |
| `src/app/api/chat/route.ts` | Streams replies (NDJSON) and mirrors them into storage for other devices |
| `src/lib/antares.ts` | Antares engine: model, system prompt, web search, demo mode |
| `src/lib/store.ts` | File-backed storage for spaces, conversations, link codes |

## Before production

- Replace the file store with a real database (Postgres) and real accounts (sign-in, not a device-held space ID).
- Replace polling with WebSockets/SSE for lower handoff latency.
- Add rate limiting and abuse protection on `/api/chat`.
- Voice in/out for home and vehicle use; native mobile and car apps (CarPlay / Android Auto).
- Antares Shield: OAuth connectors (Gmail, Microsoft, social accounts) with per-account consent and revocation.
- Video creation pipeline.
