# World Cup 2026 — Live Bracket (PWA)

An installable web app showing **all 12 groups** (with live-computed standings) and the
**full knockout branch diagram**. Tap any match for its kick-off in **Indian time (IST)**.
It's data-driven and self-updating: results live in one file, and the bracket fills itself in.

```
index.html              the whole app (UI + logic, with embedded fallback data)
data/matches.json       SINGLE SOURCE OF TRUTH — group games + knockout results
manifest.webmanifest    makes it installable to the home screen
sw.js                   service worker (offline + fresh live data)
icons/                  app icons
scripts/wc-map.mjs      maps a football API's fixtures -> matches.json shape
scripts/update.mjs      the updater the GitHub Action runs
.github/workflows/update-scores.yml   the cron that keeps scores fresh
api/matches.js          OPTIONAL Vercel endpoint for real-time scores
vercel.json, package.json
```

---

## 1) Deploy to GitHub + Vercel (5 minutes)

1. Create a new GitHub repo and push these files to it:
   ```bash
   git init
   git add .
   git commit -m "World Cup 2026 live bracket"
   git branch -M main
   git remote add origin https://github.com/<you>/wc2026-bracket.git
   git push -u origin main
   ```
2. Go to **vercel.com → Add New → Project → Import** your repo.
3. Framework preset: **Other**. No build command, no output dir — it's static. Click **Deploy**.
4. Open the Vercel URL. Because it's HTTPS, the PWA works immediately.

That alone gives you a working, installable app with the data as it is today.

---

## 2) Install on your phone (Add to Home Screen)

- **Android (Chrome):** open the site → tap the **Install** button in the app (or browser menu → *Install app*). It lands on your home screen and opens full-screen.
- **iPhone (Safari):** open the site → tap **Share** → **Add to Home Screen**. (iOS doesn't show an automatic install button — the app shows you this hint.)

---

## 3) Make it self-updating (live scores)

The app renders entirely from `data/matches.json`. "Going live" just means keeping that file fresh. Pick either path (or both).

### Option A — GitHub Action (recommended, free, self-updating repo)
A scheduled workflow fetches scores, rewrites `data/matches.json`, commits it, and Vercel auto-redeploys.

1. Get a free API key from **https://www.api-sports.io/** (API-Football).
2. In your repo: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `APIFOOTBALL_KEY`  · Value: *your key*
3. **Settings → Actions → General → Workflow permissions → Read and write permissions** (so the bot can commit).
4. Done. The workflow in `.github/workflows/update-scores.yml` runs every 10 minutes. You can also run it by hand from the **Actions** tab.

> Free API tier is ~100 requests/day. The cron is every 10 min (~144/day). If you want to
> stay strictly inside the free tier, change the cron to `*/15 * * * *` (~96/day).

### Option B — Vercel serverless endpoint (real-time while the app is open)
`api/matches.js` proxies the API live and edge-caches the result.

1. In Vercel: **Project → Settings → Environment Variables** → add `APIFOOTBALL_KEY`.
2. In `index.html`, change the one fetch line:
   ```js
   // from:
   const res = await fetch('data/matches.json?ts='+Date.now(), {cache:'no-store'});
   // to:
   const res = await fetch('/api/matches', {cache:'no-store'});
   ```
3. Redeploy. The app polls every 60s; the endpoint is cached so you don't burn quota.

### Option C — no API at all (manual)
You can just **edit `data/matches.json` by hand** and push. The schema is tiny:
```jsonc
// group game:  st is "sched" | "live" | "ft"
{ "a": "br", "b": "jp", "sa": 2, "sb": 1, "st": "ft", "day": "2026-06-29" }

// knockout match (key = match number):
"76": { "status": "finished", "a": {"code":"br","name":"Brazil"},
        "b": {"code":"jp","name":"Japan"}, "sa": 2, "sb": 1, "winner": "A" }
```
Team codes are ISO country codes (e.g. `br`, `jp`, `gb-eng` for England). Set `winner` to
`"A"` or `"B"`; the next round's card fills in automatically.

---

## How the auto-advance works
- Group **standings** are computed in the browser from the finished games — no manual tables.
- Knockout cards for later rounds say "Winner 73" until match 73 finishes. The moment a match
  has a `winner`, that team flows into the next card, all the way to the final. So you only ever
  record results; the tree updates itself.

## Updating the kick-off schedule
Knockout times/venues are fixed and live in `index.html` (the `BR` object) and `scripts/wc-map.mjs`
(`KO_DT`). They already match the official schedule; you shouldn't need to touch them.

## Tech notes
- No build step, no framework — plain HTML/CSS/JS, so it's easy to host anywhere.
- IST conversion uses the browser's `Intl` with `timeZone: 'Asia/Kolkata'`, anchored to each
  match's true kick-off instant, so it's always correct (even for Mexico-hosted ties).
- If the updater logs "Unmatched team names", add that name to `ALIASES` in `scripts/wc-map.mjs`.
