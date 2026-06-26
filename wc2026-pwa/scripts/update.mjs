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
import { applyFixtures } from './wc-map.mjs';

const KEY = process.env.APIFOOTBALL_KEY;
const LEAGUE = process.env.WC_LEAGUE_ID || '1';
const SEASON = process.env.WC_SEASON || '2026';
const FILE = new URL('../data/matches.json', import.meta.url);

async function main(){
  if(!KEY){ console.error('Missing APIFOOTBALL_KEY env var. Skipping update.'); process.exit(0); }

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
