/* wc-map.mjs — shared logic for turning a football API's fixtures
   into this app's data/matches.json shape.

   Used by:
     - scripts/update.mjs   (GitHub Action: writes the file)
     - api/matches.js        (optional Vercel live endpoint)

   It is written for API-FOOTBALL (api-sports.io) v3, whose fixture objects
   look like:
     { fixture:{date, status:{short}, venue:{name}},
       league:{round:"Group A" | "Round of 32" | "Quarter-finals" | ...},
       teams:{home:{name}, away:{name}},
       goals:{home, away},
       score:{penalty:{home,away}} }

   The strategy is OVERLAY: we read the committed data/matches.json (which already
   has the full 104-match structure) and only fill in results. That way the bracket
   structure, kickoff times and venues never get clobbered by API quirks.
*/

// Kick-off times (ET, -04:00) for every knockout match — used to match an API
// knockout fixture to the correct match number by its scheduled instant.
export const KO_DT = {
  73:'2026-06-28T15:00:00-04:00',74:'2026-06-29T16:30:00-04:00',75:'2026-06-29T21:00:00-04:00',
  76:'2026-06-29T13:00:00-04:00',77:'2026-06-30T17:00:00-04:00',78:'2026-06-30T13:00:00-04:00',
  79:'2026-06-30T21:00:00-04:00',80:'2026-07-01T12:00:00-04:00',81:'2026-07-01T20:00:00-04:00',
  82:'2026-07-01T16:00:00-04:00',83:'2026-07-02T19:00:00-04:00',84:'2026-07-02T15:00:00-04:00',
  85:'2026-07-02T23:00:00-04:00',86:'2026-07-03T18:00:00-04:00',87:'2026-07-03T21:30:00-04:00',
  88:'2026-07-03T14:00:00-04:00',89:'2026-07-04T17:00:00-04:00',90:'2026-07-04T13:00:00-04:00',
  91:'2026-07-05T16:00:00-04:00',92:'2026-07-05T20:00:00-04:00',93:'2026-07-06T15:00:00-04:00',
  94:'2026-07-06T20:00:00-04:00',95:'2026-07-07T12:00:00-04:00',96:'2026-07-07T16:00:00-04:00',
  97:'2026-07-09T16:30:00-04:00',98:'2026-07-10T15:00:00-04:00',99:'2026-07-11T17:00:00-04:00',
  100:'2026-07-11T21:00:00-04:00',101:'2026-07-14T15:00:00-04:00',102:'2026-07-15T15:00:00-04:00',
  103:'2026-07-18T17:00:00-04:00',104:'2026-07-19T15:00:00-04:00'
};

// API team name (lower-cased, simplified) -> our flag/team code.
// Add aliases here if the updater logs an "unmatched team".
export const ALIASES = {
  'mexico':'mx','south africa':'za','south korea':'kr','korea republic':'kr','czechia':'cz','czech republic':'cz',
  'canada':'ca','switzerland':'ch','qatar':'qa','bosnia and herzegovina':'ba','bosnia & herzegovina':'ba',
  'brazil':'br','morocco':'ma','scotland':'gb-sct','haiti':'ht',
  'usa':'us','united states':'us','paraguay':'py','australia':'au','turkey':'tr','türkiye':'tr','turkiye':'tr',
  'germany':'de','ecuador':'ec','ivory coast':'ci',"cote d'ivoire":'ci','côte d’ivoire':'ci','curacao':'cw','curaçao':'cw',
  'netherlands':'nl','japan':'jp','sweden':'se','tunisia':'tn',
  'egypt':'eg','belgium':'be','iran':'ir','iran islamic republic':'ir','new zealand':'nz',
  'spain':'es','uruguay':'uy','cape verde':'cv','cabo verde':'cv','saudi arabia':'sa',
  'france':'fr','norway':'no','senegal':'sn','iraq':'iq',
  'argentina':'ar','austria':'at','algeria':'dz','jordan':'jo',
  'colombia':'co','portugal':'pt','dr congo':'cd','congo dr':'cd','democratic republic of congo':'cd','uzbekistan':'uz',
  'england':'gb-eng','croatia':'hr','ghana':'gh','panama':'pa'
};

const norm = (s) => (s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
export function codeFor(apiName){ return ALIASES[norm(apiName)] || null; }

const FINISHED = new Set(['FT','AET','PEN']);
const LIVE = new Set(['1H','2H','HT','ET','BT','P','LIVE','INT']);

// Build "match number" lookup for knockout by scheduled instant (±3h tolerance)
const KO_INDEX = Object.entries(KO_DT).map(([n,iso])=>({n:+n, t:new Date(iso).getTime()}));
function koNumberByTime(iso){
  const t=new Date(iso).getTime();
  let best=null,bestd=Infinity;
  for(const k of KO_INDEX){ const d=Math.abs(k.t-t); if(d<bestd){bestd=d;best=k.n;} }
  return bestd <= 3*3600*1000 ? best : null;
}

/* Overlay API fixtures onto a base data object (parsed matches.json). Mutates & returns it. */
export function applyFixtures(base, fixtures, {log=console} = {}){
  const unmatched = new Set();

  for(const fx of (fixtures||[])){
    const round = norm(fx?.league?.round);
    const status = fx?.fixture?.status?.short;
    const date = fx?.fixture?.date;
    const hc = codeFor(fx?.teams?.home?.name);
    const ac = codeFor(fx?.teams?.away?.name);
    if(!fx?.teams?.home?.name || !fx?.teams?.away?.name) continue;
    if(!hc) unmatched.add(fx.teams.home.name);
    if(!ac) unmatched.add(fx.teams.away.name);
    if(!hc || !ac) continue;

    const gh = fx?.goals?.home, ga = fx?.goals?.away;
    const fin = FINISHED.has(status);
    const live = LIVE.has(status);
    const st = fin ? 'ft' : live ? 'live' : 'sched';
    const day = date ? String(date).slice(0,10) : undefined;

    if(round.startsWith('group')){
      // find which group contains both teams
      const key = Object.keys(base.groups).find(k => {
        const t=base.groups[k].teams; return t.includes(hc) && t.includes(ac);
      });
      if(!key){ continue; }
      const games = base.groups[key].games;
      const gm = games.find(g => (g.a===hc&&g.b===ac) || (g.a===ac&&g.b===hc));
      if(!gm) continue;
      gm.st = st; if(day) gm.day = day;
      if(fin && gh!=null){
        // orient to stored a/b
        if(gm.a===hc){ gm.sa=gh; gm.sb=ga; } else { gm.sa=ga; gm.sb=gh; }
      }
    } else {
      // knockout — locate the match number by scheduled time
      const n = koNumberByTime(date);
      if(!n) continue;
      const m = base.matches[String(n)] || (base.matches[String(n)]={status:'scheduled'});
      m.a = { code:hc, name:fx.teams.home.name };
      m.b = { code:ac, name:fx.teams.away.name };
      m.status = fin ? 'finished' : live ? 'live' : 'scheduled';
      if(gh!=null){ m.sa=gh; m.sb=ga; }
      if(fin && gh!=null){
        let win = gh>ga ? 'A' : gh<ga ? 'B' : null;
        const ph=fx?.score?.penalty;
        if(win===null && ph && ph.home!=null){
          win = ph.home>ph.away ? 'A':'B';
          m.pens = `${ph.home}–${ph.away}`;
        }
        if(win) m.winner = win;
      }
    }
  }

  if(unmatched.size && log?.warn){
    log.warn('[wc-map] Unmatched team names (add to ALIASES):', [...unmatched].join(', '));
  }
  base.updated = new Date().toISOString();
  return base;
}
