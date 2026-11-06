"""Trilha chiptune original + efeitos sincronizados aos eventos gravados. Uso: python3 synth.py <dir_dos_clipes> <saida.wav>"""
import json, glob, os, subprocess, sys, wave
import numpy as np

SR = 44100
rng = np.random.default_rng(7)
clip_dir, out = sys.argv[1], sys.argv[2]
clips = sorted(glob.glob(os.path.join(clip_dir, '[0-9]-*.mp4')))
durs = [float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', c])) for c in clips]
total = sum(durs)
N = int((total + 0.5) * SR)
music = np.zeros(N); sfx = np.zeros(N)

def t_arr(d): return np.arange(int(d * SR)) / SR
def env(n, a=0.004, d=None, curve=6.0):
    t = np.arange(n) / SR; e = np.minimum(1, t / a) if a else np.ones(n)
    return e * np.exp(-curve * t / (d or n / SR))
def pulse(f, d, duty=0.25):
    t = t_arr(d); ph = (np.cumsum(np.full(len(t), f) if np.isscalar(f) else f) / SR) % 1.0
    return np.where(ph < duty, 1.0, -1.0)
def tri(f, d):
    t = t_arr(d); ph = (f * t) % 1.0
    return 4 * np.abs(ph - 0.5) - 1
def noise(d): return rng.uniform(-1, 1, int(d * SR))
def add(buf, start, sig, gain=1.0):
    i = int(start * SR)
    if i >= len(buf) or i + len(sig) <= 0: return
    j = min(len(buf), i + len(sig)); buf[i:j] += sig[:j - i] * gain
def lowpass(x, k):
    return np.convolve(x, np.ones(k) / k, mode='same')
NOTE = lambda m: 440.0 * 2 ** ((m - 69) / 12)

# ---- música: 128 bpm, Am - F - C - G -------------------------------------------
bpm = 128; beat = 60 / bpm; bar = 4 * beat; s16 = beat / 4
chords = [(57, [69, 72, 76, 81]), (53, [65, 69, 72, 77]), (48, [64, 67, 72, 76]), (55, [62, 67, 71, 74])]
melody = [76, None, 79, 76, 74, None, 72, None, 72, 74, 76, None, 74, None, 71, None]
nbars = int(total / bar) + 2
intro = 2.4  # só arpejo durante o título
for b in range(nbars):
    t0 = b * bar
    if t0 > total: break
    root, notes = chords[b % 4]
    full = t0 >= intro
    # arpejo em semicolcheias
    for k in range(16):
        f = NOTE(notes[k % 4] + (12 if (k // 4) % 2 and full else 0))
        s = pulse(f, s16 * 0.9, 0.125) * env(int(s16 * 0.9 * SR), d=s16 * 1.4, curve=3)
        add(music, t0 + k * s16, s, 0.10 if full else 0.13)
    if not full: continue
    # baixo em colcheias
    for k in range(8):
        m = root - 12 + (12 if k % 4 == 2 else 0)
        s = tri(NOTE(m), beat / 2 * 0.95) * env(int(beat / 2 * 0.95 * SR), d=beat, curve=2)
        add(music, t0 + k * beat / 2, s, 0.30)
    # melodia a cada 2 compassos, alternando
    if b % 4 in (1, 3):
        for k, m in enumerate(melody):
            if m is None: continue
            mm = m + (0 if b % 8 < 4 else 2)
            d = s16 * 2 * 0.9
            vib = NOTE(mm) * (1 + 0.004 * np.sin(2 * np.pi * 6 * t_arr(d)))
            s = pulse(vib, d, 0.5) * env(int(d * SR), d=d * 1.6, curve=2)
            add(music, t0 + k * bar / 16, s, 0.075)
    # bateria
    for k in range(4):
        tb = t0 + k * beat
        if k in (0, 2):
            d = 0.16; t = t_arr(d); f = 140 * np.exp(-t * 25) + 45
            add(music, tb, np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), d=d, curve=5), 0.55)
        else:
            d = 0.12; n = noise(d); n = n - lowpass(n, 6)
            add(music, tb, n * env(len(n), d=d, curve=6), 0.22)
        for h in (0, 0.5):
            d = 0.03; n = noise(d); n = n - lowpass(n, 3)
            add(music, tb + h * beat, n * env(len(n), d=d, curve=8), 0.07)

# ---- efeitos -------------------------------------------------------------------
def fx(kind):
    if kind == 'click':
        d = 0.04; f = np.linspace(1500, 2100, int(d * SR)); return pulse(f, d, 0.5) * env(int(d * SR), d=d, curve=4) * 0.22
    if kind == 'coin':
        a = pulse(NOTE(83), 0.07, 0.5); b = pulse(NOTE(88), 0.22, 0.5) * env(int(0.22 * SR), d=0.22, curve=3)
        return np.concatenate([a, b]) * 0.22
    if kind == 'win':
        parts = [pulse(NOTE(m), 0.065, 0.25) for m in (84, 88, 91, 96, 100)]
        tail = pulse(NOTE(103), 0.45, 0.25) * env(int(0.45 * SR), d=0.45, curve=3)
        return np.concatenate(parts + [tail]) * 0.2
    if kind == 'boom':
        d = 0.9; n = lowpass(noise(d), 18) * env(int(d * SR), a=0.002, d=d, curve=5)
        t = t_arr(d); s = np.sin(2 * np.pi * np.cumsum(90 * np.exp(-t * 4) + 30) / SR) * env(len(t), d=d, curve=4)
        return (n * 1.4 + s * 0.8) * 0.6
    if kind == 'whoosh':
        d = 0.5; n = noise(d); n = lowpass(n, 4) - lowpass(n, 30); t = t_arr(d)
        return n * np.sin(np.pi * t / d) ** 2 * 0.55
    if kind == 'tick':
        d = 0.07; f = np.linspace(880, 1320, int(d * SR)); return pulse(f, d, 0.5) * env(int(d * SR), d=d, curve=3) * 0.12
    if kind == 'title':
        a = pulse(NOTE(79), 0.09, 0.25); b = pulse(NOTE(86), 0.3, 0.25) * env(int(0.3 * SR), d=0.3, curve=3)
        return np.concatenate([a, b]) * 0.16
    if kind == 'zoom':
        d = 0.35; t = t_arr(d); f = 300 + 500 * (t / d) ** 2
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) * 0.10
    return np.zeros(1)

offset = 0.0
for c, d in zip(clips, durs):
    meta = json.load(open(c.replace('.mp4', '.sfx.json')))
    for e in meta['events']:
        if e['t'] <= d: add(sfx, offset + e['t'], fx(e['type']))
    offset += d

# fade out final
fade = np.ones(N); fl = int(2.5 * SR); fade[-fl:] = np.linspace(1, 0, fl)
mix = music * 0.8 * fade + sfx
mix /= max(1e-9, np.max(np.abs(mix))) / 0.89
stereo = np.stack([mix, np.concatenate([[0] * 40, mix[:-40]]) * 0.97 + mix * 0.03], axis=1)
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((stereo * 32767).astype('<i2').tobytes())
print(f'{out}: {total:.1f}s, {len(clips)} clipes')
