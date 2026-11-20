#!/usr/bin/env python3
"""Mix for "105 Minutes of Knocking": synthesized crowd + English voice-over + sampled score + foley → out/mix.wav (48 kHz stereo).
Score shape: a tense pulse (kick + bass ostinato) while Spain knock; on a freeze the drums stop (stab, then hi-hat only);
the full groove arrives only with the goal. Run with the library's venv: $LIB/.venv/bin/python tools/mix.py"""
import sys, os, json
import numpy as np, soundfile as sf, soxr
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.environ['LIB']; sys.path.insert(0, LIB)
from core.audio import sampler as S
from core.audio.sfx import SR, add, lp, hp, bp, noise, env_exp, t_, thump, whoosh, step, pop, norm, limit, compress

TL = json.load(open(f'{D}/timeline.json')); DUR = TL['dur']; N = int(DUR * SR)
seg = {s['id']: s for s in TL['seg']}
S.seed(11); rng = np.random.default_rng(5)
def stereo(n=N): return np.zeros((n, 2), np.float32)
def put(buf, x, at, g=1.0):
    s = int(at * SR); e = min(len(buf), s + len(x)); buf[s:e] += x[:e - s] * g
def env(points):
    ts, gs = zip(*points); return np.interp(np.arange(N) / SR, ts, gs).astype(np.float32)

def sim2t(sid, sim):
    s = seg[sid]; return s['t0'] + (sim - s['s0']) / (s['s1'] - s['s0']) * (s['t1'] - s['t0'])
GOAL_LIVE = sim2t('live', TL['goalSim']); GOAL_FL = sim2t('flight', TL['goalSim'])
FREEZES = [k for k in ['open', 'f93', 'fz1', 'fz2', 'fz3']]

# ---------- crowd (synthesized: no match audio is used) ----------
def smooth_rand(n, rate, seed):
    r = np.random.default_rng(seed); k = max(2, int(DUR * rate) + 2)
    return np.interp(np.arange(n) / SR, np.linspace(0, DUR, k), r.random(k)).astype(np.float32)
base = np.stack([bp(rng.standard_normal(N), 260, 2400) for _ in range(2)], 1).astype(np.float32)
chant = np.stack([bp(rng.standard_normal(N), 500, 900, 4) for _ in range(2)], 1).astype(np.float32)
am = (.65 + .35 * smooth_rand(N, 1.2, 1))[:, None]
crowd = norm(base * am + .5 * chant * (.5 + .5 * np.sin(2 * np.pi * .9 * np.arange(N) / SR))[:, None], .5)
crowd_lp = np.stack([lp(crowd[:, c], 700) for c in range(2)], 1).astype(np.float32)
live_ids = ['s93', 'p93', 'live']
g_full, g_lp = np.zeros(N, np.float32), np.zeros(N, np.float32)
def span(arr, a, b, g, fi=.08, fo=.08):
    t = np.arange(N) / SR; m = np.clip((t - a) / fi, 0, 1) * np.clip((b - t) / fo, 0, 1); arr[:] = np.maximum(arr, m * g)
for k in live_ids: span(g_full, seg[k]['t0'], seg[k]['t1'], .55)
span(g_full, 8.15, 9.6, .85, .6, .05)                                     # swell under Pedri's cross
span(g_full, sim2t('live', 1.4), GOAL_LIVE, .8, .9, .02)                  # swell under the 106' cross
for k in ['slow1', 'slow2', 'flight']: span(g_lp, seg[k]['t0'], seg[k]['t1'], .55)
for k in FREEZES: span(g_lp, seg[k]['t0'], seg[k]['t1'], .45, .15, .1)
span(g_lp, seg['flat']['t0'], seg['flat']['t0'] + 1.8, .4, .05, 1.2)
crowd_mix = crowd * g_full[:, None] + crowd_lp * g_lp[:, None]
def roar(at, d=3.2, g=1.0):                                               # the goal: crowd erupts
    n = int(d * SR); tt = np.arange(n) / SR
    e = np.minimum(1, tt / .12) * np.exp(-np.maximum(0, tt - .6) / 1.4)
    x = np.stack([bp(rng.standard_normal(n), 200, 3200) for _ in range(2)], 1) * e[:, None]
    put(crowd_mix, norm(x, .9).astype(np.float32), at, g)
roar(GOAL_LIVE, 2.4, 1.0); roar(GOAL_FL, 3.0, .9)
for k in ['rew0', 'rew1']:                                                  # rewind: crowd reversed, squeezed
    a = seg[k]['t0']; src = crowd[int((a - 3) * SR):int(a * SR)][::-1]
    rv = soxr.resample(src, SR * 3 / .6, SR)[:int(.6 * SR)]; put(crowd_mix, rv.astype(np.float32), a, .45)

# ---------- voice-over ----------
vo = stereo(); vdur = json.load(open(f'{D}/audio/vo/dur.json'))
for v in TL['vo']:
    x, vsr = sf.read(f'{D}/audio/vo/{v["id"]}.wav', dtype='float32')
    if x.ndim > 1: x = x.mean(1)
    if vsr != SR: x = soxr.resample(x, vsr, SR)
    x = compress(hp(x, 90).astype(np.float32), .3, 3)
    add(vo, norm(x, .8), v['t'], 1.0, 0)
vmask = np.zeros(N, np.float32)
for v in TL['vo']:
    a, b = int(v['t'] * SR), int((v['t'] + vdur[v['id']]) * SR); vmask[a:b] = 1
k = int(.12 * SR); vmask = np.convolve(vmask, np.ones(k) / k, 'same')
duck = (1 - .55 * vmask)[:, None]

# ---------- score: sampled band, D minor, 120 BPM ----------
B = .5; ev = []
def pulse(a, b, g=1.0, build=None):
    """Tension pulse: kick on every beat, bass ostinato in eighths, closed hat; optional snare build into `build`."""
    t = a; i = 0; bass = ['D1', 'D1', 'D1', 'F1', 'D1', 'D1', 'C1', 'C1']
    while t < b - 1e-6:
        ev.append((t, 'drum_kit', 'kick_drum_left', None, .7 * g, 0))
        ev.append((t, 'electric_bass', bass[i % 8], B * .45, .6 * g, 0)); ev.append((t + B / 2, 'electric_bass', bass[i % 8], B * .4, .45 * g, 0))
        ev.append((t + B / 2, 'drum_kit', 'hi_hat_closed', None, .3 * g, .3))
        t += B; i += 1
    if build:
        b0, b1 = build; n = int((b1 - b0) / .125)
        for j in range(n): ev.append((b0 + j * .125, 'drum_kit', 'snare_2', None, .15 + .5 * j / max(1, n), 0))
def groove(a, b, g=1.0, half=False):
    t = a; i = 0; bass = ['D1', 'D1', 'F1', 'G1', 'A1', 'A1', 'C2', 'A1']
    while t < b - 1e-6:
        beat = i % 4
        ev.append((t, 'drum_kit', 'hi_hat_closed', None, .42 * g, .3)); ev.append((t + B / 2, 'drum_kit', 'hi_hat_closed', None, .28 * g, .3))
        if half:
            if beat == 0: ev.append((t, 'drum_kit', 'kick_drum_left', None, .8 * g, 0))
            if beat == 2: ev.append((t, 'drum_kit', 'snare_1', None, .55 * g, -.05))
            if beat in (0, 2): ev.append((t, 'electric_bass', bass[(i // 2) % 8], B * 1.8, .7 * g, 0))
        else:
            if beat in (0, 2) or (beat == 1 and i % 8 == 5): ev.append((t, 'drum_kit', 'kick_drum_left', None, .9 * g, 0))
            if beat in (1, 3): ev.append((t, 'drum_kit', 'snare_1', None, .75 * g, -.05))
            ev.append((t, 'electric_bass', bass[i % 8], B * .8, .75 * g, 0))
        t += B; i += 1
def stab(t, g=1.0, chord=('D4', 'F4', 'A4'), big=False):
    for p in list(chord) + (['D5'] if big else []): ev.append((t, 'trumpet_stac', p, .3, .85 * g, .15))
    for p in ['D3', 'A3']: ev.append((t, 'trombone_stac', p, .35, .85 * g, -.15))
    ev.append((t, 'timpani', 'D3', 1.2, .9 * g, 0))
    if big: ev.append((t, 'drum_kit', 'crash_left', None, .8 * g, -.3))
def hats(a, b, g=.25):
    t = a
    while t < b - .05: ev.append((t, 'drum_kit', 'hi_hat_closed', None, g, .3)); t += B / 2
def goal_hit(t):
    stab(t, 1.0, ('D4', 'F#4', 'A4'), big=True)
    for p in ['D3', 'A3', 'F#4']: ev.append((t, 'horn', p, 1.6, .55, 0))
    ev.append((t + .05, 'glockenspiel', 'D6', .6, .5, .2)); ev.append((t + .3, 'glockenspiel', 'A6', .8, .4, .25))

# cold open: near-silence on the flash, then a low timpani and hats under the first line
ev.append((.42, 'timpani', 'D2', 1.6, .55, 0)); hats(1.0, seg['open']['t1'], .18)
pulse(seg['s93']['t0'], seg['s93']['t1'], .6, build=(8.15, 9.6))
stab(seg['f93']['t0'], .6); hats(seg['f93']['t0'] + B, seg['f93']['t1'])
pulse(seg['p93']['t0'], seg['p93']['t1'], .5)
pulse(seg['live']['t0'], GOAL_LIVE - .02, .62, build=(sim2t('live', 1.4), GOAL_LIVE - .05))
goal_hit(GOAL_LIVE); groove(GOAL_LIVE + B, seg['live']['t1'], .7)
for sid in ['fz1', 'fz2', 'fz3']: stab(seg[sid]['t0'], .55); hats(seg[sid]['t0'] + B, seg[sid]['t1'])
for sid in ['slow1', 'slow2']: pulse(seg[sid]['t0'], seg[sid]['t1'], .4)
goal_hit(GOAL_FL); groove(GOAL_FL + B, seg['flight']['t1'], .8)
F0 = seg['flat']['t0']
for i in range(20): ev.append((F0 + .2 + i * .07, 'timpani', 'D2', .3, .2 + .035 * i, 0))
stab(35.0, .7)
ev.append((35.6, 'glockenspiel', 'A5', .6, .5, .2)); ev.append((36.0, 'glockenspiel', 'D6', .6, .5, .2))
groove(36.2, seg['card']['t1'], .5, half=True)
E0 = seg['end']['t0']; EL = DUR - E0
goal_hit(E0)
for p in ['D3', 'A3', 'F#4']: ev.append((E0 + .05, 'horn', p, EL - .3, .45, 0))
ev.append((E0 + .05, 'cellos', 'D2', EL - .2, .45, 0))
ev.append((E0 + 1.2, 'glockenspiel', 'F#6', .8, .35, .2)); ev.append((E0 + 1.5, 'glockenspiel', 'D6', 1.2, .3, .25))
music = S.render(ev, dur=DUR + 3)[:N].astype(np.float32)
music = S.room(music, size=.35, mix=.12)[:N]
mfade = np.ones(N, np.float32); a = int((DUR - 1.2) * SR); mfade[a:] = np.linspace(1, 0, N - a) ** 1.5
music *= mfade[:, None]

# ---------- foley ----------
fx = stereo()
def squeak(d, v=1.0, seed=0):
    r = np.random.default_rng(seed); n = int(d * SR); tt = np.arange(n) / SR
    x = bp(r.standard_normal(n), 2200, 5200)
    am_ = .55 + .45 * np.sin(2 * np.pi * (24 + 8 * r.random()) * tt + r.random() * 6) * (1 + .3 * np.sin(2 * np.pi * 3.1 * tt))
    e = np.minimum(1, tt / .02) * np.minimum(1, (d - tt) / .04)
    return (norm(x * am_ * e) * v).astype(np.float32)
def shutter(v=1.0):
    d = .09; x = hp(noise(d), 1500) * (env_exp(d, .004) + .6 * np.roll(env_exp(d, .006), int(.035 * SR)))
    return (norm(x) * v).astype(np.float32)
def kick_ball(v=1.0):
    d = .12; x = lp(noise(d), 1800) * env_exp(d, .018) + .8 * np.sin(2 * np.pi * 110 * t_(d)) * env_exp(d, .03)
    return (norm(x) * v).astype(np.float32)
for sid in FREEZES: add(fx, thump(1, 58), seg[sid]['t0'], .7); add(fx, shutter(1), seg[sid]['t0'], .45)
# marker strokes per freeze (segment-relative start, length)
STROKES = {'open': [(.75, .55)], 'f93': [(.4, .7), (1.5, .4)], 'fz1': [(1.1, .7)], 'fz2': [(.9, .5)], 'fz3': [(.9, .6)]}
RINGS = {'open': [.3, 1.2], 'f93': [.2, 1.0, 1.9], 'fz1': [.3, .7], 'fz2': [.2, .5], 'fz3': [.2, .5]}
TAGS = {'open': [1.5], 'f93': [2.2], 'fz1': [1.8], 'fz2': [1.3, 1.5, 1.9], 'fz3': [1.4]}
i = 0
for sid, L in STROKES.items():
    for a_, d_ in L: add(fx, squeak(d_, .4, i), seg[sid]['t0'] + a_, .5, (i % 3 - 1) * .2); i += 1
for sid, L in RINGS.items():
    for a_ in L: add(fx, pop(1), seg[sid]['t0'] + a_, .2, .1)
for sid, L in TAGS.items():
    for a_ in L: add(fx, step(1), seg[sid]['t0'] + a_, .25)
# ball contacts
for tt in [5.75, 6.55, 7.35, 8.15, 9.15, 13.65, sim2t('live', 1.4), sim2t('live', 2.5), sim2t('live', 2.95), sim2t('live', 3.05), seg['flight']['t0']]:
    add(fx, kick_ball(1), tt, .35, .05)
for tt in [GOAL_LIVE, GOAL_FL]: add(fx, (lp(noise(.3), 2500) * env_exp(.3, .06)).astype(np.float32), tt, .4)   # net
for tt in TL['wipes']: add(fx, whoosh(.34, 1), tt - .17, .35)
for sid in ['rew0', 'rew1']:
    w = (bp(noise(.6), 300, 2200) * np.sin(np.pi * t_(.6) / .6)).astype(np.float32); add(fx, norm(w), seg[sid]['t0'], .22)
add(fx, whoosh(1.2, 1), F0 + .1, .3)                                               # the flatten
add(fx, squeak(.6, .35, 40), 35.0, .45); add(fx, squeak(.7, .35, 41), 35.4, .45)    # moves drawn on the board
for tt in [35.6, 36.0]: add(fx, pop(1), tt, .2)
for d_ in [0, .15, .5, .6, .9, 1.0]: add(fx, step(.6), 35.2 + d_, .15)
C0 = seg['card']['t0'] + .2
for d_ in [0, .4, .55, 1.2, 1.35, 2.2, 2.35]: add(fx, step(.6), C0 + d_, .15)
add(fx, squeak(.7, .45, 42), seg['card']['t0'] + 3.4, .5)                           # red circle on the 0
for d_ in [.1, .5, .9]: add(fx, step(.6), seg['end']['t0'] + .2 + d_, .15)

# ---------- bus ----------
mix = crowd_mix * duck * .55 + vo * 1.25 + music * duck * .6 + fx * .9
tail = np.ones(N, np.float32); a = int((DUR - .45) * SR); tail[a:] = np.linspace(1, 0, N - a) ** 2
mix *= tail[:, None]
for c in range(2): mix[:, c] = limit(mix[:, c], .42)
os.makedirs(f'{D}/out', exist_ok=True); sf.write(f'{D}/out/mix.wav', mix, SR, subtype='PCM_24')
print('mix', mix.shape, 'peak', float(np.abs(mix).max()))
print(S.credits(sorted({e[1] for e in ev})))
