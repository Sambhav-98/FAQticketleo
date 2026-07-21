# Ticketleo Support Agent

A standalone AI support chat website for [ticketleo.co](https://www.ticketleo.co), powered by the OpenAI API — a full-page, ChatGPT-style site (not an embedded widget) that visitors go to directly to get help with tickets, tours, and orders.

## How it works

- `server.js` — Express server with one real endpoint, `POST /api/chat`, plus static hosting for the site itself. Each request is handled by an OpenAI model (via Chat Completions + function calling) with a `search_events` tool it calls to look up real ticket data before answering — it's instructed never to guess dates, prices, or links from memory.
- `index.html` — the full-page chat site (single self-contained file: HTML/CSS/JS). This is what visitors see at `/`.
- `events.json` — the event/tour knowledge base. Seeded with the Sushant KC PAHUNA AU/NZ 2026 tour (all six shows, ticket links, organisers, on-sale status).
- `faqs.json` — general Ticketleo platform info (contact, support hours, refund policy, how checkout works) pulled from the site's own About/Contact pages. This gets inlined into the system prompt.
- `examples.json` — sample past conversations used to steer the agent's tone/phrasing. See "Teaching the agent your tone" below.
- `conversations.log` — created automatically once the server handles its first chat. See "Conversation logging" below.
- `widget.js`, `demo.html` — deprecated. This was previously an embeddable chat-bubble widget for dropping into other pages; it's now a full standalone site instead. These two files are left in place only as no-op stubs so any old `<script src="widget.js">` embeds elsewhere don't hard-fail — safe to delete once nothing references them.

Conversation history is kept client-side (in the browser tab) and sent with every request, so the server itself doesn't need a database to function — easy to deploy anywhere. It does, however, write a log of each turn to disk (see below). There's a single ongoing conversation per browser tab/session — no saved conversation history or multi-chat sidebar.

## Setup

This project needs Node.js installed. Run these commands in a terminal, with that terminal's current directory set to this folder (the one containing `package.json`, `server.js`, etc.) — for example, on Mac/Linux: `cd ~/Downloads/ticketleo-agent` (wherever you saved these files), or on Windows: `cd C:\path\to\ticketleo-agent`, then run:

```bash
npm install
cp .env.example .env
# edit .env and paste your key from https://platform.openai.com/api-keys
npm start
```

(On Windows Command Prompt, use `copy .env.example .env` instead of `cp`.)

To start with, run this on your own computer to test locally. Once you're ready to put the site live, you'll run these same commands on whatever server/host you deploy to (see "Going live" below) — it needs to be running continuously somewhere reachable from the internet, not just on your laptop.

Then open `http://localhost:3000/` and start chatting.

## Going live

See `EMBEDDING.md` for the full step-by-step deployment checklist (hosting, env vars, HTTPS, verifying the deploy, and pointing a domain at it). Short version: deploy this project to a Node host (Render, Railway, Fly.io, a VPS), set `OPENAI_API_KEY` there, and point your domain (e.g. `support.ticketleo.co`) at the deployed URL. There's no script tag or embed step — the deployed URL *is* the site.

## Keeping the knowledge base current

- **New tour/city announced:** add a show object to `events.json`. No code or restart needed — the file is re-read on every chat request.
- **New tour entirely:** add a new object to the `tours` array in `events.json`.
- **Policy/contact changes:** edit `faqs.json`.
- If Ticketleo's catalog grows large, swap `searchEvents()` in `server.js` for a call to Ticketleo's own events API (`api.ticketleo.co`) instead of a static JSON file — the tool interface the model sees doesn't need to change.

## Guardrails already built in

- The system prompt tells the model to always call `search_events` for anything date/price/link-specific rather than recalling it, since that data changes.
- It's told never to invent order numbers, payment status, or refund approvals — anything order-specific gets routed to `hello@ticketleo.co`.
- The tool-use loop is capped at 6 turns per request to avoid runaway costs, and requests are capped at 40 messages of history.

## Teaching the agent your tone (few-shot examples)

There's no fine-tuning here — instead, `examples.json` holds a handful of real customer/agent exchanges that get inlined into the system prompt every request, so the model matches your phrasing and tone rather than generic "AI assistant" phrasing. This is the fastest, cheapest way to shape *how it talks*; it's not for adding facts (that's `events.json`/`faqs.json`).

To use your own past conversations:

1. Open `examples.json` and replace the placeholder entries with real ones — each is just `{"customer": "...", "agent": "..."}`. Copy the customer's message and the reply as close to verbatim as you can (light cleanup of typos/PII is fine).
2. **Curate, don't dump.** Pick 4-8 examples that cover different situations — an annoyed customer, a refund question, a quick factual lookup, someone asking something off-topic — rather than pasting in fifty transcripts. More examples means a longer prompt (slower, more expensive) on *every single message*, and past a certain point they start contradicting each other instead of reinforcing a consistent voice. `server.js` hard-caps this at the first 8 entries in the file regardless (`MAX_EXAMPLES`), so trim the file itself rather than relying on that cap.
3. Save the file — no restart needed, it's re-read on every request just like `events.json`/`faqs.json`.
4. If a reply still isn't in your voice after a few tries, that's more useful signal than volume: swap in a *better-matched* example for that situation rather than adding a ninth one.

If `examples.json` is missing or its `examples` array is empty, the agent just skips that section and behaves as before — it's optional.

## Model choice

Default is `gpt-5.6-terra` (set via `OPENAI_MODEL` in `.env`), a balance of quality and cost that suits FAQ + tool-calling. Swap to `gpt-5.6-sol` if answers need to get sharper on edge cases, or `gpt-5.6-luna` if you want the cheapest/fastest option for high message volume.

## Conversation logging

Every reply the server sends is also appended to `conversations.log` in the project folder, one JSON object per line (JSONL), e.g.:

```json
{"timestamp":"2026-07-15T09:12:03.441Z","sessionId":"a1b2c3d4-...","turnCount":3,"userMessage":"When is the Sydney show?","assistantReply":"The Sydney show is Sep 5, 2026 ..."}
```

- `sessionId` is a random ID `index.html` generates once per page load, so you can group a visitor's turns into one conversation by filtering on it. It resets if they refresh the page — there's no cross-session visitor tracking.
- Logging is fire-and-forget (`fs.appendFile`, not awaited), so a disk hiccup never breaks or slows down the chat response itself; it just skips that line and logs the error to the server console.
- The file is created automatically on first use and grows indefinitely — nothing rotates or deletes old entries yet.

**Before relying on this in production:**

- `conversations.log` will contain whatever visitors type — potentially emails, order numbers, or other personal info. It's already in `.gitignore` so it won't get committed, but you're still responsible for how it's stored, who can access the server's filesystem, and how long you keep it under Ticketleo's own privacy policy.
- On ephemeral hosts (some free tiers of Render/Railway/Fly), the local disk resets on redeploy — this log won't survive that. Attach a persistent volume, or swap `logTurn()` in `server.js` for a database/log-drain call if you need durability across deploys.
- Add log rotation (e.g. a daily cron that gzips and archives the file, or a max-size check) before this runs unattended for months.

## Things to add before real production use

- **Auth/rate limiting** on `/api/chat` (e.g. per-IP throttling) — currently open, fine for a prototype/demo but not for a public production endpoint.
- **Streaming responses** (OpenAI supports SSE via `stream: true`) if you want the reply to appear token-by-token instead of all at once.
- **Real events data source** — replace the static `events.json` with a live pull from Ticketleo's backend so it never goes stale.
