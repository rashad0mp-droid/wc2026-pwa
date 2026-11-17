import { createGuitar } from './guitar.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const nav = $('#nav'), hero = $('#hero'), anatomy = $('#anatomy'), specSec = $('#spec'), stage = $('#stage');
const chapters = $$('.chapter'), pips = $$('#pips li');

/* ---------- finishes ---------- */
const FINISH = {
  'Butterscotch': { color: 0xcf8a1c, grain: true, rough: 0.38 },
  'White Blonde': { color: 0xe9dcb6, grain: true, rough: 0.4 },
  'Gloss Black': { color: 0x0c0c0d, grain: false, rough: 0.22 },
  'Oxblood': { color: 0x6e120f, grain: false, rough: 0.25 },
  'Lake Blue': { color: 0x153f66, grain: false, rough: 0.25 },
};
const GUARD = { 'Black Bakelite': 'black', 'Parchment': 'parchment', 'Tortoise': 'tortoise' };
const pick = { finish: 'Butterscotch', guard: 'Black Bakelite', board: 'Maple', wood: 'Swamp ash', neck: 'Soft V', wind: 'Classic wind' };

const g = createGuitar(stage);

/* ---------- poses ---------- */
const Z = { guard: 0, hard: 0, neck: 0, str: 0 };
function poses() {
  const narrow = innerWidth / innerHeight < 0.95;
  const X = narrow ? 0 : g.viewW() * 0.235, Y = narrow ? 22 : 0, k = narrow ? 0.52 : 1;
  return [
    { x: narrow ? 3 : X + 3, y: narrow ? 15 : -2, s: narrow ? 0.46 : 0.68, rx: 0.1, ry: -0.5, rz: -0.55, focus: 25, ...Z },                 // hero
    { x: X, y: Y, s: 1.22 * k, rx: 0.22, ry: 0.6, rz: -0.18, focus: 0, guard: 1, hard: 1, neck: 0, str: 1 },                                // body
    narrow ? { x: 0, y: 22, s: 0.6, rx: 0.35, ry: -0.3, rz: -1.3, focus: 38, guard: 0, hard: 0, neck: 0.6, str: 1 } : { x: X + 3, y: -2, s: 1.08, rx: 0.32, ry: -0.6, rz: -0.42, focus: 36, guard: 0, hard: 0, neck: 1, str: 1 }, // neck
    { x: X - (narrow ? 0 : 2), y: Y + 1, s: 1.42 * k, rx: 0.5, ry: -0.42, rz: -0.08, focus: -2, guard: 0.5, hard: 0.55, neck: 0, str: 1 },                         // pickups
    { x: X, y: Y, s: 0.68 * k, rx: 0.05, ry: 0.35, rz: -0.36, focus: 25, ...Z },                                                           // finish
    { x: X + (narrow ? 0 : 2), y: narrow ? 20 : -1, s: narrow ? 0.4 : 0.66, rx: 0.02, ry: -0.3, rz: narrow ? -1.1 : -0.3, focus: 25, ...Z }, // spec
  ];
}
let P = g ? poses() : [];
addEventListener('resize', () => { if (g) P = poses(); });

const target = {}, user = { ry: 0, rx: 0, drag: false };
let chapter = -1, sway = 0.12, cycleT = 0, cycleI = 0;

function onScroll() {
  const vh = innerHeight, y = scrollY;
  const ar = anatomy.getBoundingClientRect(), sr = specSec.getBoundingClientRect();
  const p = clamp(-ar.top / (ar.height - vh));
  nav.classList.toggle('solid', y > 40);

  // u walks the pose list: 0 hero, 1..4 anatomy chapters, 5 spec
  let u;
  if (ar.top > 0) u = smooth(0.25, 1, 1 - ar.top / vh);
  else if (p < 1) { const f = p * 4, i = Math.min(3, Math.floor(f)); u = i === 0 ? 1 : i + smooth(0, 0.34, f - i); }
  else u = 4 + smooth(0, 0.8, 1 - sr.top / vh);
  if (g) {
    const i = Math.min(P.length - 2, Math.floor(u)), t = u - i, a = P[i], b = P[i + 1];
    for (const kx in a) target[kx] = a[kx] + (b[kx] - a[kx]) * t;
    // on phones the copy scrolls underneath the guitar between scenes: dim it while that happens
    const narrow = innerWidth / innerHeight < 0.95;
    const between = narrow && ((y > vh * 0.14 && ar.top > 4) || (ar.bottom < vh * 0.98 && sr.top > vh * 0.1) || sr.top < -vh * 0.12);
    stage.style.opacity = sr.bottom < vh * 0.55 ? 0 : between ? 0.16 : 1;
    state.live = sr.bottom > 0;
  }
  const idx = ar.top > vh * 0.4 ? -1 : ar.bottom < vh * 0.75 ? 4 : Math.min(3, Math.floor(p * 4));
  if (idx !== chapter) {
    chapter = idx;
    chapters.forEach((c, i) => { c.classList.toggle('is-active', i === clamp(idx, 0, 3)); c.classList.toggle('is-past', i < idx); });
    pips.forEach((li, i) => li.classList.toggle('on', i === clamp(idx, 0, 3)));
    if (idx !== 3) applyPick();
  }
}
const state = { live: true };

/* ---------- options ---------- */
function applyPick() {
  if (!g) return;
  g.setFinish(FINISH[pick.finish]); g.setGuard(GUARD[pick.guard]); g.setBoard(pick.board.toLowerCase());
}
function sheet() {
  $('#sheetLine').innerHTML = `<b>${pick.finish}</b> nitro over one-piece ${pick.wood.toLowerCase()} · ${pick.guard.toLowerCase()} guard · ${pick.board.toLowerCase()} board, ${pick.neck} neck · hand-wound pickups, ${pick.wind.toLowerCase()}`;
  const body = `Hi Walker,%0D%0A%0D%0AI'd like to talk about a build:%0D%0A- Finish: ${pick.finish}%0D%0A- Body: ${pick.wood}%0D%0A- Pickguard: ${pick.guard}%0D%0A- Fretboard: ${pick.board}%0D%0A- Neck profile: ${pick.neck}%0D%0A- Pickups: ${pick.wind}%0D%0A%0D%0AHow I play: `;
  $('#sendSpec').href = `mailto:walker.doubleday@gmail.com?subject=${encodeURIComponent('Custom build: ' + pick.finish)}&body=${body.replace(/ /g, '%20')}`;
}
$$('#opts fieldset').forEach((fs) => fs.addEventListener('change', (e) => { pick[fs.dataset.key] = e.target.value; applyPick(); sheet(); user.ry += 0.5; }));
sheet();

/* ---------- drag to turn ---------- */
let lx = 0, ly = 0;
addEventListener('pointerdown', (e) => { if (!e.target.closest('[data-drag]')) return; user.drag = true; lx = e.clientX; ly = e.clientY; });
addEventListener('pointermove', (e) => { if (!user.drag) return; user.ry += (e.clientX - lx) * 0.008; user.rx = clamp(user.rx + (e.clientY - ly) * 0.004, -0.5, 0.5); lx = e.clientX; ly = e.clientY; }, { passive: true });
addEventListener('pointerup', () => { user.drag = false; }); addEventListener('pointercancel', () => { user.drag = false; });

/* ---------- loop ---------- */
addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); onScroll();
if (g) {
  applyPick();
  Object.assign(g.state, target);
  const names = Object.keys(FINISH), cyc = $('#finishCycle');
  let prev = performance.now();
  const frame = (now) => {
    const dt = Math.min(now - prev, 100); prev = now;
    if (state.live && !document.hidden) {
      const k = reduce ? 1 : 1 - Math.exp(-dt / 190);
      const st = g.state;
      if (!user.drag) { user.ry += (0 - user.ry) * (1 - Math.exp(-dt / 2600)); user.rx += (0 - user.rx) * (1 - Math.exp(-dt / 1400)); }
      const wide = chapter === 3 ? 0.85 : sway;
      const idle = reduce ? 0 : Math.sin(now / 1900) * wide;
      for (const kx in target) { const goal = target[kx] + (kx === 'ry' ? idle + user.ry : kx === 'rx' ? user.rx : 0); st[kx] += (goal - st[kx]) * k; }
      // the finish chapter cycles through colours
      if (chapter === 3 && !reduce) { cycleT += dt; if (cycleT > 1500) { cycleT = 0; cycleI = (cycleI + 1) % names.length; g.setFinish(FINISH[names[cycleI]]); cyc.textContent = names[cycleI]; } }
      g.render();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
} else { stage.remove(); document.documentElement.classList.add('no-webgl'); }

/* ---------- gallery strip: drag with the mouse ---------- */
const strip = $('#strip'); let sd = false, sx = 0, sl = 0, moved = 0;
strip.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; sd = true; moved = 0; sx = e.clientX; sl = strip.scrollLeft; });
addEventListener('pointermove', (e) => { if (!sd) return; moved = Math.abs(e.clientX - sx); if (moved > 4) strip.classList.add('dragging'); strip.scrollLeft = sl - (e.clientX - sx); });
addEventListener('pointerup', () => { sd = false; strip.classList.remove('dragging'); });

/* ---------- reveals ---------- */
const targets = $$('.page .sec-head > *, .strip figure, .line-card, .maker-photo, .maker-copy > *, .maker-detail, .steps li, .proof > *, .repairs-grid > *, .foot .mega, .foot-grid > div');
if ('IntersectionObserver' in window && !reduce) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
  targets.forEach((el) => { el.classList.add('rv'); const sibs = [...el.parentElement.children].filter((c) => targets.includes(c)); el.style.setProperty('--d', `${Math.min(sibs.indexOf(el), 5) * 0.06}s`); io.observe(el); });
}
