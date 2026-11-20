#!/usr/bin/env python3
"""THE HONESTY LAYER — original numpy-synth score + HUD foley + ambience + voice → out/mix.wav (48 kHz stereo, 45.0 s).
D minor/Dorian, 100 BPM. Pad + sparse arp (4–21 s); a low pulse builds 21–31 s and drops out at 31.0 (0.6 s of true silence);
pad + one sustained tone under the reflection; a soft chord bloom at the self-alignment lock; power-down tone at 40.2.
Run: LIB=<library> $LIB/.venv/bin/python tools/mix.py"""
import sys, os, json
import numpy as np, soundfile as sf, soxr
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.environ['LIB']; sys.path.insert(0, LIB)
from core.audio.sfx import SR, add, lp, hp, bp, noise, env_exp, t_, thump, whoosh, norm, limit, compress

TL = json.load(open(f'{D}/timeline.json')); DUR = TL['dur']; N = int(DUR * SR)
rng = np.random.default_rng(3)
BPM = 100; B = 60 / BPM
def st(n=N): return np.zeros((n, 2), np.float32)
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def m(n):  # 'D3', 'Bb2', 'F#4'
    acc = 1 if '#' in n else -1 if 'b' in n[1:] else 0
    return 12 * (int(n[-1]) + 1) + NOTE[n[0]] + acc
def adsr(n, a=.01, r=.2, sus=1.0):
    e = np.ones(n) * sus; A = max(1, int(a * SR)); R = max(1, min(n, int(r * SR)))
    e[:A] = np.linspace(0, sus, A); e[-R:] *= np.linspace(1, 0, R); return e
def saw(f, d, det=0.0):
    tt = t_(d); ph = (f * (1 + det)) * tt; return 2 * (ph - np.floor(ph + .5))
def tone(f, d, kind='sine'):
    tt = t_(d)
    if kind == 'sine': return np.sin(2 * np.pi * f * tt)
    if kind == 'sq': return np.sign(np.sin(2 * np.pi * f * tt)) * .6
    return saw(f, d)

music = st(); fx = st(); amb = st(); vo = st()

# ---------- pad: detuned saws, low-passed, chord every 2 bars ----------
CH = [['D3', 'F3', 'A3', 'C4', 'E4'], ['Bb2', 'D3', 'F3', 'A3', 'C4'], ['F2', 'A3', 'C4', 'E4', 'G4'], ['C3', 'E3', 'G3', 'A3', 'D4']]
BAR = 4 * B; L2 = 2 * BAR
def pad(a, b, g=1.0, chords=CH, fo=1.0):
    t = a; i = 0
    while t < b - .05:
        d = min(L2, b - t) + .6
        for j, n in enumerate(chords[i % len(chords)]):
            f = mtof(m(n)); x = sum(saw(f, d, det) for det in (-.004, 0, .005)) / 3
            x = lp(x, 1400) * adsr(len(x), .9, .9)
            add(music, (x * .09 * g).astype(np.float32), t, 1.0, (j - 2) * .25)
        t += L2; i += 1
pad(0.4, 21.0, .8); pad(21.0, 31.0, 1.0); pad(31.6, 40.4, .85, [CH[0], CH[1]])
# sustained tone (boot, and under the reflection)
for a, b, n, g in [(0.5, 4.0, 'A4', .05), (31.6, 40.2, 'A4', .045)]:
    d = b - a; x = tone(mtof(m(n)), d) * adsr(int(round(d * SR)), 1.2, 1.4); add(music, (x * g).astype(np.float32), a, 1.0, 0)

# ---------- arpeggio: square pluck with ping-pong delay, scooped for the voice ----------
ARP = ['D4', 'A4', 'F4', 'C5', 'E5', 'C5', 'A4', 'F4']
def arp(a, b, g=1.0, step=B / 2, oct_=0):
    t = a; i = 0; dry = st()
    while t < b - .05:
        f = mtof(m(ARP[i % 8]) + 12 * oct_); d = .22
        x = tone(f, d, 'sq') * env_exp(d, .06); add(dry, (x * .06 * g).astype(np.float32), t, 1.0, .3 if i % 2 else -.3)
        t += step; i += 1
    # ping-pong delay (dotted 8th)
    dl = int(.75 * B * SR); out = dry.copy()
    for k in range(1, 4):
        sh = np.zeros_like(dry); sh[dl * k:] = dry[:-dl * k] * (.45 ** k)
        if k % 2: sh = sh[:, ::-1]
        out += sh
    for c in range(2): out[:, c] = out[:, c] - .6 * bp(out[:, c], 1000, 4000)
    music[:] += out
arp(4.8, 21.0, .8); arp(21.0, 31.0, 1.0); arp(28.2, 31.0, .7, B / 4, 1)

# ---------- pulse 21–31: 8th bass + kick, building; hats from 25.8 ----------
def kick(): d = .35; tt = t_(d); f = 120 * np.exp(-tt * 18) + 45; return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .12)
def hat(): d = .06; return hp(noise(d), 7000) * env_exp(d, .015)
t = 21.0; i = 0
while t < 31.0 - 1e-6:
    bld = .35 + .65 * (t - 21.0) / 10
    f = mtof(m('D1' if (i // 16) % 2 == 0 else 'Bb0')); d = B / 2 * .9
    x = lp(saw(f, d) + .5 * saw(f * 2, d), 900) * adsr(int(round(d * SR)), .005, .06)
    add(music, (x * .16 * bld).astype(np.float32), t, 1.0, 0)
    if i % 2 == 0: add(music, (kick() * .32 * bld).astype(np.float32), t, 1.0, 0)
    if t >= 25.8: add(music, (hat() * .1 * bld).astype(np.float32), t + B / 4, 1.0, .3)
    t += B / 2; i += 1

# soft chord bloom at self-alignment lock (37.6): wide Dmaj9 swell
for j, n in enumerate(['D3', 'A3', 'F#4', 'E4', 'A4', 'D5']):
    d = 2.8; f = mtof(m(n)); x = sum(saw(f, d, det) for det in (-.006, 0, .007)) / 3
    x = lp(x, 2200) * adsr(int(round(d * SR)), .05, 1.6)
    add(music, (x * .08).astype(np.float32), 37.6, 1.0, (j - 2.5) * .3)
# power-down tone
d = 1.4; tt = t_(d); f = 520 * np.exp(-tt * 2.6) + 40
x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, (d - tt) / .4); add(music, (x * .12).astype(np.float32), 40.2, 1.0, 0)
# true silence 31.0–31.6, and a final fade
music[int(31.0 * SR):int(31.6 * SR)] = 0
fade = np.ones(N, np.float32); a = int(44.0 * SR); fade[a:] = np.linspace(1, 0, N - a) ** 1.5; music *= fade[:, None]

# ---------- HUD foley (blips in key) ----------
KEY = [m(n) for n in ['D5', 'F5', 'A5', 'C6', 'E6']]
def blip(n, d=.07, v=1.0): x = tone(mtof(n), d) * env_exp(d, .02); return (x * v).astype(np.float32)
def lock(v=1.0, col='cyan'):
    out = np.zeros(int(.4 * SR), np.float32)
    th = thump(1, 62)[:len(out)]; out[:len(th)] += th * .5
    c = (hp(noise(.03), 2500) * env_exp(.03, .006)).astype(np.float32); out[:len(c)] += c * .5
    hi = {'cyan': (m('A5'), m('D6')), 'amber': (m('F5'), m('C6')), 'green': (m('D6'), m('A6'))}[col]
    b1 = blip(hi[0], .06, .35); b2 = blip(hi[1], .09, .35); out[int(.05 * SR):int(.05 * SR) + len(b1)] += b1; out[int(.12 * SR):int(.12 * SR) + len(b2)] += b2
    return out * v
def chatter(a, b, v=.12, seed=0):
    r = np.random.default_rng(seed); t = a
    while t < b: add(fx, blip(KEY[r.integers(len(KEY))] + 12, .018, v), t, 1.0, r.uniform(-.4, .4)); t += 1 / 30
def sweep(a, d, f0=300, f1=1800, v=.12):
    tt = t_(d); f = np.geomspace(f0, f1, len(tt)); x = bp(noise(d), 600, 5000) * .3 + np.sin(2 * np.pi * np.cumsum(f) / SR) * .4
    x *= np.sin(np.pi * tt / d); add(fx, (x * v).astype(np.float32), a, 1.0, 0)
# boot
r = np.random.default_rng(1)
for k in range(10): add(fx, blip(KEY[k % 5], .03, .18), .5 + k * .08 + r.uniform(0, .03), 1.0, r.uniform(-.5, .5))
chatter(1.0, 2.1, .1, 1); add(fx, lock(.8), 2.1); chatter(1.9, 2.4, .08, 2); add(fx, lock(.6, 'green'), 2.4)
# café
sweep(4.3, 2.1)
for lt in [6.6, 7.0, 7.4, 7.8, 8.2]: add(fx, lock(.65), lt + .22)
for t0 in [8.8, 10.0, 11.2]:
    add(fx, blip(m('A5'), .05, .2), t0); chatter(t0 + .55, t0 + 1.2, .08, int(t0 * 10)); add(fx, lock(.75, 'amber'), t0 + 1.2)
add(fx, whoosh(.5, 1) * .35, 13.0); chatter(13.8, 15.0, .07, 7); chatter(15.9, 16.8, .09, 8); add(fx, lock(.85, 'amber'), 16.8)
# city
add(fx, whoosh(1.4, 1) * .45, 21.0)
for a_, b_, col in [(22.95, 23.6, 'amber'), (24.45, 24.9, 'green'), (27.0, 27.6, 'green')]: chatter(a_, b_, .09, int(a_)); add(fx, lock(.8, col), b_)
for k in range(30): add(fx, blip(KEY[k % 5] + 12, .04, .05), 23.8 + k * .14, 1.0, np.sin(k) * .6)   # meters turning
# reflection: hesitant chirps, glitch, lock, feature locks, meter
sweep(31.6, 1.4, 250, 1400, .1)
for tt_, n in [(33.0, m('A5')), (33.6, m('F5')), (34.6, m('A5')), (35.2, m('C6'))]: add(fx, blip(n, .05, .14), tt_)
add(fx, (bp(noise(.1), 800, 6000) * .5).astype(np.float32), 35.6)
add(fx, lock(1.0), 36.22)
for lt in [36.35, 36.5, 36.65, 36.8, 36.95]: add(fx, blip(m('D6'), .04, .14), lt + .18)
d = .6; tt = t_(d); f = np.geomspace(400, 1200, len(tt)); add(fx, (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / d) * .08).astype(np.float32), 37.0)
chatter(37.2, 37.6, .08, 9); add(fx, lock(1.0, 'green'), 37.6)
# power-down + title
for k in range(4): add(fx, blip(KEY[3 - k], .05, .12), 40.0 + k * .08)
chatter(40.9, 41.7, .09, 11); add(fx, lock(.7), 41.7); chatter(41.5, 42.0, .06, 12); chatter(41.85, 42.3, .05, 13)

# ---------- ambience ----------
hum = sum(np.sin(2 * np.pi * f * np.arange(N) / SR) * g for f, g in [(40, .6), (80, .35), (120, .2)]) * .012
hum_env = np.interp(np.arange(N) / SR, [0, .5, 1.0, 40.0, 41.0, 45], [0, 0, 1, 1, 0, 0])
amb += (hum * hum_env)[:, None].astype(np.float32)
def bed(a, b, lo, hi, g, seed):
    n = int((b - a) * SR); r = np.random.default_rng(seed)
    x = np.stack([bp(r.standard_normal(n), lo, hi) for _ in range(2)], 1)
    e = np.minimum(1, np.minimum(np.arange(n) / (.6 * SR), (n - np.arange(n)) / (.6 * SR)))[:, None]
    put = (x * e * g).astype(np.float32); s = int(a * SR); amb[s:s + n] += put[:N - s]
bed(4.0, 21.2, 300, 1800, .02, 4)          # café murmur
bed(21.0, 31.0, 120, 900, .03, 5)          # street wash
bed(31.6, 40.2, 200, 600, .006, 6)         # glass room tone
add(fx, (blip(m('E7'), .25, .12) + blip(m('B6'), .25, .08)).astype(np.float32), 5.2, 1.0, -.4)   # cup clink
amb[int(31.0 * SR):int(31.6 * SR)] = 0; fx[int(31.0 * SR):int(31.6 * SR)] = 0

# ---------- voice ----------
vd = json.load(open(f'{D}/audio/vo/dur.json'))
mask = np.zeros(N, np.float32)
for v in TL['vo']:
    x, vsr = sf.read(f'{D}/audio/vo/{v["id"]}.wav', dtype='float32')
    if x.ndim > 1: x = x.mean(1)
    if vsr != SR: x = soxr.resample(x, vsr, SR)
    x = compress(hp(x, 80).astype(np.float32), .3, 3)
    add(vo, norm(x, .8).astype(np.float32), v['t'], 1.0, 0)
    a_, b_ = int(v['t'] * SR), int((v['t'] + vd[v['id']]) * SR); mask[a_:b_] = 1
# held duck: max-filter 0.5 s, then smooth
from scipy.ndimage import maximum_filter1d, uniform_filter1d
hold = maximum_filter1d(mask, int(.5 * SR)); hold = uniform_filter1d(hold, int(.15 * SR))
duck_m = (1 - .82 * hold)[:, None]; duck_f = (1 - .6 * hold)[:, None]

mix = music * duck_m * 1.0 + fx * duck_f * .9 + amb * duck_f + vo * 1.3
tail = np.ones(N, np.float32); a = int((DUR - .4) * SR); tail[a:] = np.linspace(1, 0, N - a) ** 2; mix *= tail[:, None]
for c in range(2): mix[:, c] = limit(mix[:, c], .45)
os.makedirs(f'{D}/out', exist_ok=True); sf.write(f'{D}/out/mix.wav', mix.astype(np.float32), SR, subtype='PCM_24')
print('mix', mix.shape, 'peak', float(np.abs(mix).max()))
