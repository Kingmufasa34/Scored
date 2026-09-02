# Scored — Delay Repay agent

Automates UK train **Delay Repay** claims end to end:

1. **Pulls tickets from your email** — reads booking-confirmation emails from Gmail (read-only) and extracts the journeys, booking reference, ticket type and fare.
2. **Checks the actual train times** — looks each leg up on the [Realtime Trains](https://api.rtt.io) API and works out how late (or cancelled) the train really was.
3. **Fills in the claim** — matches the delay to the operator's Delay Repay scheme, estimates the payout, and either **prepares a fully pre-filled claim** for you to review, or **auto-fills the operator's web form** via a browser (opt-in).

```
Gmail message ──parse──▶ Ticket ──RTT lookup──▶ DelayResult ──scheme──▶ Claim ──▶ prepare | auto-submit
```

> ⚠️ Delay Repay claims are a formal request for compensation. **Always review a prepared claim before submitting**, and only auto-submit journeys you actually took. Operator schemes and thresholds change — the figures here are estimates.

## Quick start (no accounts needed)

```bash
npm install
npm run dev -- demo
```

`demo` runs the whole pipeline against a bundled sample confirmation and a canned delayed service, and writes a pre-filled claim under `prepared-claims/demo/`. Good for seeing the output shape before wiring up your accounts.

## Real setup

```bash
cp .env.example .env      # then edit it (see below)
npm run auth:gmail        # one-time Gmail authorisation
npm run dev -- run        # pull tickets → check delays → prepare claims
```

### 1. Realtime Trains

Register for the free personal **Pull API** at <https://api.rtt.io> and put the credentials in `.env`:

```
RTT_USERNAME=your-rtt-username
RTT_PASSWORD=your-rtt-password
```

### 2. Gmail (OAuth, read-only)

1. In the [Google Cloud Console](https://console.cloud.google.com) create a project, enable the **Gmail API**, and create an **OAuth client ID** of type **Desktop app**.
2. Download the client secret JSON to `./credentials.json` (or set `GMAIL_CREDENTIALS_PATH`).
3. Run `npm run auth:gmail`, open the printed URL, grant access, and paste the code back. A refresh token is saved to `gmail-token.json`.
4. Tune `GMAIL_QUERY` in `.env` so it matches the senders you get tickets from, e.g.:
   ```
   GMAIL_QUERY=from:(auto-confirm@trainline.com OR no-reply@gwr.com) newer_than:35d
   ```

`credentials.json`, `gmail-token.json` and `.env` are gitignored — never commit them.

## Phone app (mobile web dashboard)

There's a mobile-first web front end so you can run everything from your phone — see your journeys, delays and estimated payouts, and prepare a claim with one tap. It installs to your home screen as a PWA.

```bash
npm run dev:serve      # dev (tsx), http://localhost:3000
# or, built:
npm run build && npm run serve
```

Open it on your phone, then **Add to Home Screen** for an app icon. It opens on a **sign-in page** where you connect your accounts — **Continue with Google** for email and a **Connect** form for your Realtime Trains login — no files or terminal needed. Until both are connected it runs on the bundled **sample data** ("Explore with sample data"), so you can try the whole flow immediately.

**One-time server setup for the Google button:** browser sign-in needs a Google OAuth **Web application** client. Create one in the Google Cloud Console with an authorised redirect URI of `<your app origin>/auth/google/callback` (e.g. `http://localhost:3000/auth/google/callback`), then either drop it in `credentials.json` or set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. After that, every sign-in is just a tap. (The CLI `npm run auth:gmail` still works with a "Desktop app" client if you prefer.)

Because it reads your private email and files real claims, the app runs **with your credentials** — so host it yourself rather than on a public site:
- **Same Wi-Fi:** run it on a laptop/Pi and open `http://<that-machine-ip>:3000` on your phone.
- **From anywhere:** put it behind a tunnel (`cloudflared tunnel --url http://localhost:3000` or ngrok), or deploy to a private host (Render/Railway/Fly). Set `PORT` via env; mount `credentials.json`, `gmail-token.json`, `.env` as secrets.

API (same server): `GET /api/state`, `POST /api/refresh`, `POST /api/claims/:id/prepare`, `POST /api/claims/:id/submit`, `GET /api/claims/:id/markdown`.

## Commands (CLI)

| Command | What it does |
|---|---|
| `scored demo [--preview]` | Run end-to-end on bundled sample data (no setup). |
| `scored run [options]` | Pull tickets from Gmail, check delays, prepare/submit claims. |
| `scored list` | Show previously processed claims. |
| `scored operators` | List known operators and their Delay Repay schemes. |
| `scored help` | Usage. |

`run` options: `--preview` (compute only, don't write/submit), `--mode prepare|auto`, `--max <n>`, `--headed` and `--confirm` (auto mode).

During development run these via `npm run dev -- <command>` (e.g. `npm run dev -- run --preview`). After `npm run build`, use `node dist/index.js <command>`.

## Submission modes

- **`prepare` (default, safe)** — writes a Markdown + JSON claim per eligible leg to `prepared-claims/`, with every field ready to paste into the operator's form, plus the RTT evidence. Never touches an operator website.
- **`auto` (opt-in, brittle)** — opens the operator's Delay Repay form in a headless browser (Playwright), fills every field it has a selector for, screenshots for your records, and — only with `--confirm` **and** a wired-up submit selector — clicks submit.

  Operator forms change constantly and many use logins/CAPTCHAs, so auto mode ships with **no** per-operator selectors by default: out of the box it opens the form and screenshots it. Add a `formSelectors` map to an operator in [`src/claim/operators.ts`](src/claim/operators.ts) to make that operator hands-off. Install the browser first:
  ```bash
  npm i -D playwright && npx playwright install chromium
  ```

## How compensation is worked out

Each delayed leg is matched to its operator's scheme ([`src/claim/operators.ts`](src/claim/operators.ts)):

- **Delay Repay 15** (most operators): 15–29 min → 25%, 30–59 → 50%, 60–119 → 100% of the single-leg fare, 120+ → 100% of the whole fare.
- **Delay Repay 30** (LNER, ScotRail, some open-access): same bands from 30 minutes.

For a **return** ticket, one delayed leg is compensated on **half** the total fare (the 120+ band pays on the full fare). **Cancellations** are treated as a maximum-length delay and land in the top band. **Season tickets** are flagged as eligible but not estimated (payout depends on daily-fare apportionment).

## Extending it

- **Stations** — the resolver in [`src/rail/stations.ts`](src/rail/stations.ts) covers the busiest GB stations. Add entries (or drop in the full RDG station-codes dataset) if a journey can't be resolved. Tickets carrying a CRS code skip resolution.
- **Operators / schemes** — edit the registry in [`src/claim/operators.ts`](src/claim/operators.ts). Unknown operators fall back to Delay Repay 15.
- **Email formats** — extraction lives in [`src/email/extract.ts`](src/email/extract.ts); it's format-agnostic (station pairs + nearby dates/times) so it copes with most confirmations, but you can add sender-specific handling in [`src/email/parse.ts`](src/email/parse.ts).
- **Rail data source** — swap Realtime Trains for another provider by implementing `RailDataProvider` ([`src/rail/provider.ts`](src/rail/provider.ts)).

## Architecture

```
public/                 mobile PWA front end (index.html · styles.css · app.js · sw.js)
src/
  index.ts              CLI (run · demo · list · operators)
  server.ts             Express API + serves the phone app
  web/                  web deps factory + claim DTO
  pipeline.ts           orchestrator: email → parse → delay → build → submit
  config.ts             .env-driven configuration
  types.ts              domain model
  email/
    provider.ts         EmailProvider interface
    gmail.ts            Gmail API (read-only) implementation
    authorize.ts        one-time OAuth flow (npm run auth:gmail)
    extract.ts          journey / reference / fare extraction
    parse.ts            message → Ticket
  rail/
    provider.ts         RailDataProvider interface
    realtimeTrains.ts   RTT Pull API client + journey matching
    delay.ts            booked-vs-actual delay computation
    stations.ts         station-name → CRS resolver
  claim/
    operators.ts        operator registry + Delay Repay schemes
    compensation.ts     delay + scheme → payout
    builder.ts          Ticket + DelayResult → Claim
    fields.ts           claim → form-field values
    render.ts           prepared-claim Markdown
    submitter.ts        PrepareSubmitter (default)
    playwrightSubmitter.ts   auto form-fill (opt-in)
  store/store.ts        JSON dedupe store
  demo.ts               fixtures for `scored demo`
test/                   vitest suite
```

## Development

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run build       # tsc → dist/
```

## Limitations & good faith

- Journey matching relies on the ticket's departure time; if a confirmation omits times, matching is best-effort.
- Scheme percentages are encoded to the 2025/26 season and should be verified against each operator's own Delay Repay page before relying on a figure.
- This tool helps you file **genuine** claims for delays you experienced. Don't use it to submit claims for journeys you didn't take.
