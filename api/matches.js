/* api/matches.js  (OPTIONAL — real-time path)
   Serves data/matches.json, and — if APIFOOTBALL_KEY is set in Vercel env —
   live-enriches it from the football API on the fly.

   It is edge-cached (s-maxage) so many visitors share one upstream call and you
   don't burn through your API quota.

   To use this instead of the static file, change ONE line in index.html:
       const res = await fetch('data/matches.json?ts='+Date.now(), {cache:'no-store'});
   becomes:
       const res = await fetch('/api/matches', {cache:'no-store'});

   If you don't set the key, this still works — it just returns the committed file
   (which the GitHub Action keeps fresh).
*/
import { applyFixtures } from '../scripts/wc-map.mjs';

export default async function handler(req, res){
  try{
    const proto = (req.headers['x-forwarded-proto'] || 'https');
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseRes = await fetch(`${proto}://${host}/data/matches.json`, { cache: 'no-store' });
    const base = await baseRes.json();

    const KEY = process.env.APIFOOTBALL_KEY;
    if(KEY){
      const LEAGUE = process.env.WC_LEAGUE_ID || '1';
      const SEASON = process.env.WC_SEASON || '2026';
      const r = await fetch(`https://v3.football.api-sports.io/fixtures?league=${LEAGUE}&season=${SEASON}`, {
        headers: { 'x-apisports-key': KEY }
      });
      if(r.ok){
        const j = await r.json();
        applyFixtures(base, j?.response || []);
      }
    }

    // cache at the edge for 60s; serve stale up to 5 min while refreshing
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify(base));
  }catch(e){
    res.status(500).json({ error: String(e) });
  }
}
