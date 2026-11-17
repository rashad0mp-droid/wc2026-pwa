import { createSea } from './sea.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- scroll-driven dusk ---------- */
const nav = $('#nav'), evening = $('#evening'), page = $('.page'), quote = $('#quote');
const steps = $$('.step'), photos = $$('.evening-photos figure'), rail = $('#rail'), clock = $('#clock');

// progress through the evening -> time of day (0 golden .. 1 night) and wall clock (minutes)
const P = [0, 0.2, 0.4, 0.6, 0.8, 1];
const DAY = [0.0, 0.07, 0.30, 0.56, 0.76, 1.0];
const MIN = [17 * 60 + 30, 18 * 60, 19 * 60 + 10, 19 * 60 + 45, 21 * 60, 21 * 60 + 50];
function key(arr, p) {
  for (let i = 0; i < P.length - 1; i++) if (p <= P[i + 1]) { const t = (p - P[i]) / (P[i + 1] - P[i]); return arr[i] + (arr[i + 1] - arr[i]) * t; }
  return arr[arr.length - 1];
}
function fmt(m) { m = Math.round(m); let h = Math.floor(m / 60), mm = m % 60; return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} PM`; }

const state = { day: 0, target: 0, visible: true, inQuote: false, look: [0, 0], lookT: [0, 0] };
let lastStep = -1;

function onScroll() {
  const vh = innerHeight;
  const er = evening.getBoundingClientRect();
  const p = clamp(-er.top / (er.height - vh));
  const pr = page.getBoundingClientRect(), qr = quote.getBoundingClientRect();
  const inQuote = qr.top < vh * 0.95;
  state.target = inQuote ? 0.9 : key(DAY, p);
  state.inQuote = inQuote;
  state.visible = pr.top > 0 || inQuote;
  nav.classList.toggle('on-page', pr.top < 64 && qr.top > 64);

  const idx = Math.min(steps.length - 1, Math.floor(p * steps.length));
  if (idx !== lastStep) {
    steps.forEach((s, i) => { s.classList.toggle('is-active', i === idx); s.classList.toggle('is-past', i < idx); });
    photos.forEach((f, i) => f.classList.toggle('is-active', i === idx));
    lastStep = idx;
  }
  rail.style.transform = `scaleX(${p})`;
  clock.textContent = fmt(key(MIN, p));
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
onScroll();

// on portrait screens turn the camera toward the sun so it stays in frame
const baseYaw = () => (innerWidth / innerHeight < 0.9 ? 0.2 : 0);
state.look[0] = state.lookT[0] = baseYaw();
addEventListener('resize', () => { state.lookT[0] = baseYaw(); });
addEventListener('pointermove', (e) => {
  state.lookT[0] = baseYaw() + (e.clientX / innerWidth - 0.5) * 0.05;
  state.lookT[1] = -(e.clientY / innerHeight - 0.5) * 0.018;
}, { passive: true });

const sea = createSea($('#sea'));
if (!sea) { $('#sea').remove(); document.documentElement.classList.add('no-webgl'); }
else {
  state.day = state.target;
  let prev = performance.now(), t0 = prev;
  const frame = (now) => {
    const dt = now - prev; prev = now;
    if (state.visible && !document.hidden) {
      const k = reduce ? 1 : 1 - Math.exp(-Math.min(dt, 400) / 260), kl = 1 - Math.exp(-Math.min(dt, 400) / 600);
      state.day += (state.target - state.day) * k;
      state.look[0] += (state.lookT[0] - state.look[0]) * kl;
      state.look[1] += (state.lookT[1] - state.look[1]) * kl;
      // the yacht enters from the right, crosses the sun at sunset, and is gone behind the quote form
      sea.uniforms.uYaz.value = state.inQuote ? 3 : 0.73 - 0.93 * state.day;
      sea.uniforms.uDay.value = state.day;
      sea.uniforms.uLook.value.set(state.look[0], state.look[1]);
      sea.render(reduce ? 12 : (now - t0) / 1000, dt);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  window.__sea = { state, sea };
}

/* ---------- fleet fit ---------- */
const YACHTS = {
  sundream: {
    name: 'm/y Sun Dream', kind: '137 ft · the intimate one', min: 16, max: 149,
    img: 'assets/img/sun-dream-exterior.jpg', alt: 'm/y Sun Dream under way on the Intracoastal at golden hour',
    desc: 'Our namesake, and the one couples fall for. A custom-decorated main salon with a dance floor, a dining salon with a baby grand, and a thousand square feet of open sky up top.',
    specs: [['Length', '137 ft'], ['Guests', '16 – 149'], ['Open deck', '1,000 sq ft']],
    list: ['Bridal stateroom with a private powder room', 'Dining salon with water views and a baby grand piano', 'Second full bar on the outdoor deck'],
    cta: 'Check a date for Sun Dream',
  },
  caprice: {
    name: 'm/y Caprice', kind: '130 ft · the all-rounder', min: 75, max: 329,
    img: 'assets/img/caprice-exterior.jpg', alt: 'm/y Caprice cruising past the Fort Lauderdale skyline',
    desc: 'A whole deck given to dinner, a whole salon given to everything after. Five-foot bay windows keep the water in view from every table.',
    specs: [['Length', '130 ft'], ['Guests', '75 – 329'], ['Main salon', '1,700 sq ft']],
    list: ['Seated dinner service for up to 160 on the first deck', 'Custom bar, baby grand and lounge seating in the salon', 'Partially enclosed top deck with bar and outdoor dance floor'],
    cta: 'Check a date for Caprice',
  },
  catalina: {
    name: 'm/y Catalina', kind: '130 ft · the grand one', min: 150, max: 516,
    img: 'assets/img/catalina-sunset.jpg', alt: 'm/y Catalina at sunset off Fort Lauderdale',
    desc: 'Built for galas and large weddings. Dinner and dancing share one level in a dining room wrapped in bay windows, so nobody is ever in the other room.',
    specs: [['Length', '130 ft'], ['Guests', 'up to 516'], ['Dining room', '2,700 sq ft']],
    list: ['Dining and dancing on a single level', 'Top deck with eight-foot ceilings and a second full bar', 'Open-air dance floor on the top deck aft'],
    cta: 'Check a date for Catalina',
  },
};
const order = ['sundream', 'caprice', 'catalina'];
const range = $('#guests'), out = $('#guestOut b'), marker = $('#fitMarker'), rows = $$('.fit-row');
const panel = $('#yachtPanel');
let current = null, manual = false, swapT;

const fits = (y, g) => g >= YACHTS[y].min && g <= YACHTS[y].max;
const best = (g) => (g <= 149 ? 'sundream' : g <= 329 ? 'caprice' : 'catalina');

function showYacht(id, g) {
  const y = YACHTS[id];
  const tag = fits(id, g) || (id === 'catalina' && g <= 516 && g >= 100)
    ? (id === best(g) ? `Best fit for ${g} guests` : `Also works for ${g} guests`)
    : (g > y.max ? `${g} is over capacity` : `Roomy for ${g} guests`);
  const fill = () => {
    $('#yachtImg').src = y.img; $('#yachtImg').alt = y.alt;
    $('#yachtKind').textContent = y.kind; $('#yachtName').textContent = y.name; $('#yachtDesc').textContent = y.desc;
    $('#yachtSpecs').innerHTML = y.specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('#yachtList').innerHTML = y.list.map((l) => `<li>${l}</li>`).join('');
    $('#yachtCta').textContent = y.cta;
  };
  $('#yachtTag').textContent = tag;
  if (current === id) return;
  const first = current === null;
  current = id;
  rows.forEach((r) => { const on = r.dataset.yacht === id; r.classList.toggle('is-active', on); r.setAttribute('aria-selected', on); });
  if (first || reduce) return fill();
  panel.classList.add('swap'); clearTimeout(swapT);
  swapT = setTimeout(() => { fill(); requestAnimationFrame(() => panel.classList.remove('swap')); }, 320);
}

function onGuests(fromUser) {
  const g = +range.value;
  out.textContent = g;
  const x = (g - 16) / 500;
  range.style.setProperty('--p', `${x * 100}%`);
  marker.style.setProperty('--x', x);
  rows.forEach((r) => r.classList.toggle('fits', fits(r.dataset.yacht, g)));
  if (fromUser) manual = false;
  showYacht(manual ? current : best(g), g);
  const fg = $('#f-guests'); if (fg && fromUser) fg.value = g;
}
range.addEventListener('input', () => onGuests(true));
rows.forEach((r) => r.addEventListener('click', () => { manual = true; showYacht(r.dataset.yacht, +range.value); }));
onGuests(false);

/* ---------- occasions: image follows the cursor ---------- */
const float = $('#occFloat'), floatImg = $('img', float);
if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
  let fx = 0, fy = 0, tx = 0, ty = 0, on = false, raf;
  const tick = () => {
    fx += (tx - fx) * 0.14; fy += (ty - fy) * 0.14;
    float.style.transform = `translate(${fx}px,${fy}px) translate(-50%,-50%) rotate(${(tx - fx) * 0.02}deg)`;
    raf = on || Math.abs(tx - fx) > 0.5 ? requestAnimationFrame(tick) : null;
  };
  $$('#occList li').forEach((li) => {
    li.addEventListener('pointerenter', (e) => {
      floatImg.src = li.dataset.img; on = true; float.classList.add('on');
      if (!raf) { fx = e.clientX + 180; fy = e.clientY; raf = requestAnimationFrame(tick); }
    });
    li.addEventListener('pointermove', (e) => { tx = e.clientX + 180; ty = e.clientY; });
    li.addEventListener('pointerleave', () => { on = false; float.classList.remove('on'); });
  });
  $$('#occList li').forEach((li) => { const i = new Image(); i.src = li.dataset.img; });
}

/* ---------- reveals ---------- */
const targets = $$('.sec-head > *, .fit, .yacht, .occ-list li, .dining-a, .dining-b, .dining-copy > *, .family-copy > *, .family-photo, .promises li, .review, .review-score, .quote-copy > *, .quote-form');
if ('IntersectionObserver' in window && !reduce) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  targets.forEach((el) => {
    el.classList.add('rv');
    const sibs = [...el.parentElement.children].filter((c) => targets.includes(c));
    el.style.setProperty('--d', `${Math.min(sibs.indexOf(el), 6) * 0.07}s`);
    io.observe(el);
  });
}

/* ---------- quote form (front-end only in this concept) ---------- */
const form = $('#quoteForm'), note = $('#formNote');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  let bad = false;
  $$('[required]', form).forEach((f) => { const err = !f.checkValidity(); f.closest('.field').classList.toggle('err', err); bad = bad || err; });
  if (bad) { note.textContent = 'Please add your name and a valid email so we can reply.'; note.classList.remove('ok'); return; }
  note.textContent = 'Thank you. On the live site this lands in the Sun Dream office inbox.';
  note.classList.add('ok');
});
