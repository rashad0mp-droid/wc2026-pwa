/* scripts/update.mjs
   Pulls live World Cup fixtures from API-FOOTBALL and overlays the results onto
   data/matches.json. Run by .github/workflows/update-scores.yml on a schedule.

   Requires env var:  APIFOOTBALL_KEY   (free key from https://www.api-sports.io/)

   Notes:
   - league=1 is the FIFA World Cup in API-Football; season=2026.
   - If your provider differs, only this file's fetch() needs changing — the
     mapping lives in scripts/wc-map.mjs.
   - It only writes the file when something actually changed (keeps git history clean).
*/
import { readFile, writeFile } from 'node:fs/promises';
import { applyFixtures, KO_DT } from './wc-map.mjs';

/* Quota saver: only spend an API call when a match is actually in progress.
   Knockout kickoff times are known exactly, so we open a window from 5 min
   before kickoff to ~2h45m after (covers half-time, stoppage, ET + penalties).
   During the group stage (until 28 Jun) exact times aren't in our data, so we
   fall back to the broad daily window when matches are played (15:00–05:00 UTC). */
function aMatchIsLiveNow(){
  const now = Date.now();
  const PRE = 5*60*1000, POST = 2.75*3600*1000;
  for(const iso of Object.values(KO_DT)){
    const k = new Date(iso).getTime();
    if(now >= k - PRE && now <= k + POST) return true;
  }
  const today = new Date();
  const groupStage = today < new Date('2026-06-28T00:00:00Z');
  if(groupStage){ const h = today.getUTCHours(); if(h >= 15 || h <= 5) return true; }
  return false;
}

const KEY = process.env.APIFOOTBALL_KEY;
const LEAGUE = process.env.WC_LEAGUE_ID || '1';
const SEASON = process.env.WC_SEASON || '2026';
const FILE = new URL('../data/matches.json', import.meta.url);

async function main(){
  if(!KEY){ console.error('Missing APIFOOTBALL_KEY env var. Skipping update.'); process.exit(0); }

  if(process.env.FORCE !== '1' && !aMatchIsLiveNow()){
    console.log('No match in its live window right now — skipping API call to save quota.');
    return;
  }

  const base = JSON.parse(await readFile(FILE, 'utf-8'));
  const before = JSON.stringify(base);

  const res = await fetch(`https://v3.football.api-sports.io/fixtures?league=${LEAGUE}&season=${SEASON}`, {
    headers: { 'x-apisports-key': KEY }
  });
  if(!res.ok){ console.error('API error', res.status, await res.text()); process.exit(1); }
  const json = await res.json();
  const fixtures = json?.response || [];
  console.log(`Fetched ${fixtures.length} fixtures.`);

  applyFixtures(base, fixtures, { log: console });

  // ignore the auto-updated timestamp when deciding "did anything change"
  const cmp = (o) => { const c = JSON.parse(JSON.stringify(o)); delete c.updated; return JSON.stringify(c); };
  if(cmp(JSON.parse(before)) === cmp(base)){
    console.log('No result changes — leaving file as is.');
    return;
  }
  await writeFile(FILE, JSON.stringify(base, null, 1) + '\n', 'utf-8');
  console.log('data/matches.json updated.');
}

main().catch((e) => { console.error(e); process.exit(1); });
