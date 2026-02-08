# VercelPings

Simple Vercel Cron Job that pings a list of URLs every 5 minutes.

## Edit targets

Update `targets.json` (or set `TARGETS_JSON` to another path).

Config format:

```json
{
  "timeoutMs": 60000,
  "targets": ["https://example.onrender.com"]
}
```

Optional env vars:

- `TIMEOUT_MS`: override timeout (ms)
- `FAIL_ON_ERROR`: set to `true` to exit non-zero if any ping fails
- `TARGETS_JSON`: path to the JSON config file (default `targets.json`)

## Run locally

```bash
npm install
npm run ping
```

## Deploy on Vercel

This repo includes `vercel.json` with a Cron Job scheduled for every 5 minutes (`*/5 * * * *`) that hits `GET /api/ping`.

Note: Vercel cron schedules use UTC.
