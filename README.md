# Polyform Production Log

Shared production log for the extrusion and cutting teams: tablets on the floor log every batch,
the office sees output, waste, the roll pipeline and order progress, and downloads Excel.

## Run it

```bash
cp .env.example .env   # set APP_PASSWORD
npm install
npm run dev            # http://localhost:3170 (API + Vite in one process)
```

Production on your own machine: `npm run build && npm start`. Data lives in `data/db.json`; back that file up.

## Deploy on Vercel

Vercel functions cannot keep a file between requests, so on Vercel the log is stored in
Upstash Redis instead. The API is the same code in both places: `server/core.mjs` holds the
routes, sign-in, throttling and checks; `server/index.mjs` runs it locally, and `api/*.js` runs it as
Vercel functions. `vercel.json` builds the Vite app into `dist/`.

1. In the Vercel project, open **Storage → Create → Upstash for Redis** (Marketplace) and connect it
   to the project. That adds the store credentials to the project's environment variables.
2. Add `APP_PASSWORD` and `SESSION_SECRET` under **Settings → Environment Variables**.
3. Deploy. The first sign-in fills the empty store with the demo data, the same as a new local install.

Environment variables:

| Variable | Needed | What it is |
| --- | --- | --- |
| `APP_PASSWORD` | yes | The shared password the tablets and office sign in with. |
| `SESSION_SECRET` | yes on Vercel | Long random string that signs the session cookie (`openssl rand -hex 32`). Changing it signs everyone out. If unset it is derived from `APP_PASSWORD`. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | on Vercel | Upstash Redis REST URL and token. Added by the Upstash integration. `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` work too. |
| `STORE` | no | `file` or `redis` to force a store. By default Redis is used when its credentials are set, the file otherwise. |
| `STORE_PREFIX` | no | Key prefix in Redis, default `pf:`. Lets a preview or a test share one database without mixing data. |
| `PORT` | no | Local server port, default 3170. |

Data in Redis: `pf:entries` (hash of entry id → entry), `pf:settings`, `pf:rev`, and
`pf:fail:<ip>` for failed sign-ins (expires after ten minutes).

To try the Vercel setup locally, link the folder to a Vercel project and run `vercel dev`. It
serves the Vite app and the `api/` functions, using the project's **Development** environment
variables (tick Development when adding them, and use a separate `STORE_PREFIX` there, such as
`dev:`, so local tries never touch the live log):

```bash
vercel link
vercel dev
```

`npm run dev` keeps using `data/db.json` unless the Redis variables are in `.env` (or `STORE=redis`);
with them, the local server reads and writes the hosted store, which is the live log once deployed.

## What is in it

- **Overview** — today (or the last working day) for both teams, 14/30-day output and waste chart,
  roll pipeline (waiting → cutting → finished), high-waste entries, machines this week, open orders.
- **New entry** — one form for both stages. Worker and machine as tap targets, roll-batch picker for
  cutting (customer and product fill in), mix recipes that split a total by ratio, live yield ring,
  checklist, draft kept on the tablet, ⌘↵ to save, Undo after saving.
- **Batches** — every extrusion batch with what is left to cut; a trace sheet from mix to finished bags.
- **Orders** — every PO typed on an entry, with optional target pieces and due date; late/ready status.
- **Reports** — day/week/month/custom, previous-period comparison, daily chart, breakdowns,
  sortable searchable entry table, Excel (same sheets as before), CSV, print.
- **Lists & settings** — dropdown lists with reordering, mix recipes, waste limits, week start, demo data.
- ⌘K / `/` search, keys 1–6 for pages, light/dark/auto, works offline (saves sync later).

API (same on both hosts): `GET /api/state[?rev=n]`, `POST /api/entries {upsert, remove}`, `PUT /api/settings`, `POST /api/login`, `POST /api/logout`.
