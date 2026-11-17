import { createField } from './pavers.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const nav = $('#nav'), proc = $('#process'), lab = $('#lab'), canvas = $('#field'), sheet = $('#sheet');
const steps = $$('.step'), rail = $$('#rail li');
const f = createField(canvas);

/* ---------- camera scenes ---------- */
function scenes() {
  const n = innerWidth / innerHeight < 0.95;
  return n ? {
    hero: { tx: 0, tz: -31, d: 82, phi: 0.88, theta: 0.3 },
    plan: { tx: 0, tz: 25, d: 140, phi: 0.001, theta: 0 },
    build: { tx: 0, tz: 34, d: 104, phi: 0.8, theta: -0.3 },
    lab: { tx: 0, tz: 24, d: 90, phi: 0.62, theta: 0.2 },
  } : {
    hero: { tx: -24, tz: 1, d: 70, phi: 0.98, theta: 0.42 },
    plan: { tx: -22, tz: 0, d: 112, phi: 0.001, theta: 0 },
    build: { tx: -24, tz: 0, d: 66, phi: 1.02, theta: -0.36 },
    lab: { tx: -25, tz: 0, d: 80, phi: 0.72, theta: 0.26 },
  };
}
let S = scenes(); addEventListener('resize', () => { S = scenes(); });
const lerpScene = (a, b, t) => ({ tx: mix(a.tx, b.tx, t), tz: mix(a.tz, b.tz, t), d: mix(a.d, b.d, t), phi: mix(a.phi, b.phi, t), theta: mix(a.theta, b.theta, t) });

const cur = { ...S.hero, built: 0, lift: 0 }, goal = { ...S.hero, built: 1, lift: 0 };
const state = { live: true, intro: 0, inAnim: 0, step: -1, laid: false };
const pick = { pattern: 'Herringbone', blend: 'Charleston Pearl' };

function onScroll() {
  const vh = innerHeight, pr = proc.getBoundingClientRect(), lr = lab.getBoundingClientRect();
  const p = clamp(-pr.top / (pr.height - vh));
  nav.classList.toggle('solid', scrollY > 40);

  let sc, built;
  if (pr.top > 0) { const t = smooth(0.15, 1, 1 - pr.top / vh); sc = lerpScene(S.hero, S.plan, t); built = 1 - smooth(0.1, 0.8, t); }
  else if (p < 1) { sc = lerpScene(S.plan, S.build, smooth(0.74, 0.95, p)); built = smooth(0.5, 0.72, p); }
  else { sc = lerpScene(S.build, S.lab, smooth(0, 0.8, 1 - lr.top / vh)); built = 1; }
  Object.assign(goal, sc, { built });

  const idx = pr.top > vh * 0.45 ? -1 : Math.min(3, Math.floor(p * 4));
  if (idx !== state.step) {
    state.step = idx;
    steps.forEach((s, i) => { s.classList.toggle('is-active', i === Math.max(0, idx)); s.classList.toggle('is-past', i < idx); });
    rail.forEach((r, i) => r.classList.toggle('on', i <= idx));
  }
  sheet.classList.toggle('on', pr.top < vh * 0.2 && p > 0.2 && p < 0.74);
  state.live = lr.bottom > 0;
  canvas.style.opacity = lr.bottom < vh * 0.5 ? 0 : 1;
}
addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); onScroll();

/* ---------- pattern lab ---------- */
function relay(origin) {
  if (!f) return;
  const rot = pick.pattern.includes('45');
  f.setRotation(rot ? Math.PI / 4 : 0);
  f.lay(rot ? 'Herringbone' : pick.pattern, pick.blend, origin);
  state.inAnim = 0;
}
function label() {
  $('#labResult').textContent = `${pick.pattern} in ${pick.blend}`;
  $('#labCta').href = `mailto:info@3-creek.com?subject=${encodeURIComponent('Sample request: ' + pick.pattern + ' in ' + pick.blend)}`;
}
$('#pickPattern').addEventListener('change', (e) => { pick.pattern = e.target.value; relay(); label(); });
$('#pickBlend').addEventListener('change', (e) => { pick.blend = e.target.value; relay(); label(); });
label();

/* ---------- loop ---------- */
if (f) {
  relay();
  let lastMove = 0;
  addEventListener('pointermove', (e) => { f.pointer(e.clientX, e.clientY); lastMove = performance.now(); }, { passive: true });
  Object.assign(cur, goal, { built: 0 });
  let prev = performance.now(); const t0 = prev;
  const frame = (now) => {
    const dt = Math.min(now - prev, 100); prev = now;
    if (state.live && !document.hidden) {
      const k = reduce ? 1 : 1 - Math.exp(-dt / 220);
      // intro: the drawing lands first, then the sweep turns it into stone
      state.inAnim = Math.min(1, state.inAnim + dt / (reduce ? 1 : 1900));
      const introBuilt = reduce ? 1 : smooth(900, 3400, now - t0);
      for (const key of ['tx', 'tz', 'd', 'phi', 'theta']) cur[key] += (goal[key] - cur[key]) * k;
      cur.built += (Math.min(goal.built, introBuilt) - cur.built) * (1 - Math.exp(-dt / 320));
      cur.lift += ((now - lastMove < 1600 ? 1 : 0) - cur.lift) * (1 - Math.exp(-dt / 400));
      f.U.uIn.value = state.inAnim; f.U.uLift.value = reduce ? 0 : cur.lift;
      f.U.uEdge.value = mix(-f.R - 4, f.R + 4, cur.built);
      f.setCamera(cur); f.render();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
} else { canvas.remove(); document.documentElement.classList.add('no-webgl'); }

/* ---------- reveals ---------- */
const targets = $$('.page .sec-head > *, .work-grid figure, .mat-list li, .under-copy > *, .section-cut, .score, .voices blockquote, .faq-list details, .start .display, .start-cta, .start-contact');
if ('IntersectionObserver' in window && !reduce) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
  targets.forEach((el) => { el.classList.add('rv'); const sibs = [...el.parentElement.children].filter((c) => targets.includes(c)); el.style.setProperty('--d', `${Math.min(sibs.indexOf(el), 5) * 0.06}s`); io.observe(el); });
}
