# Ticketleo Support Agent

An AI support agent for [ticketleo.co](https://www.ticketleo.co), powered by the OpenAI API. It ships two frontends over the same backend and the same `/api/chat` endpoint: a full-page, ChatGPT-style site (`index.html`) that visitors go to directly, and an embeddable popup widget (`widget.js`) for dropping a LEO launcher bubble onto any existing page. Use either one, or both — they don't depend on each other.

## How it works

- `server.js` — Express server with one real endpoint, `POST /api/chat`, plus static hosting for the site itself. Each request is handled by an OpenAI model (via Chat Completions + function calling) with a `search_events` tool it calls to look up real ticket data before answering — it's instructed never to guess dates, prices, or links from memory.
- `index.html` — the full-page chat site (single self-contained file: HTML/CSS/JS). This is what visitors see at `/`.
- `events.json` — the event/tour knowledge base. Seeded with the Sushant KC PAHUNA AU/NZ 2026 tour (all six shows, ticket links, organisers, on-sale status).
- `faqs.json` — general Ticketleo platform info (contact, support hours, refund policy, how checkout works) pulled from the site's own About/Contact pages. This gets inlined into the system prompt.
- `examples.json` — sample past conversations used to steer the agent's tone/phrasing. See "Teaching the agent your tone" below.
- `conversations.log` — created automatically once the server handles its first chat. See "Conversation logging" below.
- `widget.js` — the embeddable popup widget: a launcher bubble that opens a small panel (compact floating panel on desktop, full-screen sheet on mobile so the on-screen keyboard never covers the conversation). Self-contained (injects its own styles/markup, scoped so it won't clash with the host page's CSS) and talks to the same `/api/chat` endpoint as `index.html`, using the same conversation format. See "Embeddable widget" below.
- `demo.html` — a bare page for testing `widget.js` locally against this server. Not a stand-in for the real ticketleo.co site.

Conversation history is kept client-side (in the browser tab) and sent with every request, so the server itself doesn't need a database to function — easy to deploy anywhere. It does, however, write a log of each turn to disk (see below). There's a single ongoing conversation per browser tab/session — no saved conversation history or multi-chat sidebar. This is true for both frontends.

## Embeddable widget

To add the LEO popup bubble to an existing page (the real ticketleo.co site, a tour landing page, anywhere), add one script tag:

```html
<script src="https://YOUR-DEPLOYED-SERVER/widget.js"></script>
```

By default the widget infers the API's origin from that same script URL (i.e. `https://YOUR-DEPLOYED-SERVER/api/chat`), so the one-liner above is all most pages need. If the widget script is hosted somewhere different from the API (e.g. served from a CDN), point it explicitly before the script tag:

```html
<script>window.TICKETLEO_API_URL = 'https://YOUR-DEPLOYED-SERVER/api/chat';</script>
<script src="https://YOUR-CDN/widget.js"></script>
```

The widget exposes a small API on `window.TicketleoWidget` for the host page's own UI to hook into:

```js
TicketleoWidget.open();          // opens the panel
TicketleoWidget.close();         // closes it
TicketleoWidget.toggle();        // opens/closes
TicketleoWidget.newChat();       // resets the conversation
TicketleoWidget.ask('Is there parking available?'); // opens and sends a message
```

To test locally: `npm start`, then open `http://localhost:3000/demo.html`.

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

See `EMBEDDING.md` for the full step-by-step deployment checklist (hosting, env vars, HTTPS, verifying the deploy, and pointing a domain at it). Short version: deploy this project to a Node host (Render, Railway, Fly.io, a VPS), set `OPENAI_API_KEY` there, and point your domain (e.g. `support.ticketleo.co`) at the deployed URL. From there you can link to the deployed URL directly (it *is* the full-page site), and/or add the one `<script src=".../widget.js">` tag from "Embeddable widget" above to the real ticketleo.co pages to get the popup bubble instead — both point at the same deployment, so no separate hosting step is needed for the widget.

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

### Making the log survive redeploys

On ephemeral hosts (some free tiers of Render/Railway/Fly), the local disk resets on every redeploy, which would otherwise wipe `conversations.log`. Two optional env vars (unset by default, so nothing changes unless you configure them — see `.env.example`) fix this:

- **`LOG_FILE_PATH`** — write the log to a path on a mounted persistent volume instead of the app folder, e.g. `LOG_FILE_PATH=/data/conversations.log`. The folder is created automatically if it doesn't exist yet. This is the right fix if your host offers volumes (Render/Railway/Fly all do, usually on a paid tier).
- **`LOG_WEBHOOK_URL`** — in addition to the file, POST every turn as JSON to an external endpoint (a small serverless function that writes to a database, a logging service like Logtail/Datadog, a Zapier/Make webhook, etc.), e.g. `LOG_WEBHOOK_URL=https://your-log-drain.example.com/ticketleo-conversations`. This is the right fix if you don't have (or don't want) a volume — the request is fire-and-forget with a 5s timeout, so a slow or unreachable endpoint never blocks or breaks the chat response.

You can set either one, both, or neither. Both write independently in `logTurn()` in `server.js` — if you'd rather replace the file write entirely with a direct database call, that function is a single, self-contained place to do it.

#### Free option: use a Google Sheet as the log drain (works on Render's free tier)

Render's free tier doesn't offer a persistent disk, so `LOG_FILE_PATH` alone won't help there. `LOG_WEBHOOK_URL` doesn't need a disk at all — pointing it at a free Google Apps Script "Web App" is the simplest no-cost way to get a durable, human-readable log:

1. Create a new Google Sheet (e.g. "Ticketleo Conversations"). Optionally add a header row: `Timestamp | Session ID | Turn Count | User Message | Assistant Reply`.
2. In the sheet, go to **Extensions > Apps Script**, delete the placeholder code, and paste:
   ```javascript
   function doPost(e) {
     var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
     var data = JSON.parse(e.postData.contents);
     sheet.appendRow([data.timestamp, data.sessionId, data.turnCount, data.userMessage, data.assistantReply]);
     return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
   }
   ```
3. Save the project (any name), then **Deploy > New deployment**, type **Web app**. Set "Execute as" to **Me** and "Who has access" to **Anyone** (required — the server calls it anonymously, not as a signed-in Google user). Deploy and authorize it when prompted.
4. Copy the resulting URL (ends in `/exec`) and set it as `LOG_WEBHOOK_URL` in Render's Environment settings.
5. Redeploy, send a test chat message, and confirm a new row appears in the sheet.

Notes: treat that URL as a secret — anyone who has it could POST rows to your sheet — but since it's only ever used server-side in `server.js`, it's never exposed to site visitors. Apps Script's free quotas (per-day execution limits) are generous enough for a low/moderate-traffic FAQ bot but worth knowing about if traffic grows a lot. If you edit the script later, use **Manage deployments > Edit** rather than creating a new deployment, so the URL (and your `LOG_WEBHOOK_URL` setting) doesn't change.

**Before relying on this in production:**

- `conversations.log` (and anything sent to `LOG_WEBHOOK_URL`) will contain whatever visitors type — potentially emails, order numbers, or other personal info. The local file is already in `.gitignore` so it won't get committed, but you're still responsible for how it's stored, who can access it (including whatever's on the other end of your webhook), and how long you keep it under Ticketleo's own privacy policy.
- Add log rotation (e.g. a daily cron that gzips and archives the file, or a max-size check) before this runs unattended for months.

## Things to add before real production use

- **Auth/rate limiting** on `/api/chat` (e.g. per-IP throttling) — currently open, fine for a prototype/demo but not for a public production endpoint.
- **Streaming responses** (OpenAI supports SSE via `stream: true`) if you want the reply to appear token-by-token instead of all at once.
- **Real events data source** — replace the static `events.json` with a live pull from Ticketleo's backend so it never goes stale.
