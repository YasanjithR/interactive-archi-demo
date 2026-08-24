"""Placeholder stems for M83 - Solitude, standing in until the real recording is
separated. Four stems named for the four musical elements the panel responds to:

    chords   accented sustained chords — carries the rhythm in place of percussion
    melody   the minor-key line
    reverb   the reverberant tail — smear of everything else, sitting behind it
    vocals   layered wordless voices

Slow, A minor, Am-F-C-G. Deliberately plain: this exists to prove the mechanic,
not to be listened to. Replace via `bash tools/prepare.sh real`.
"""
import numpy as np, wave, os, sys

SR   = 48000
BPM  = 76
BEAT = 60.0 / BPM
BAR  = BEAT * 4
BARS, REPS = 8, 4
N    = int(BAR * BARS * REPS * SR)

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

#            root  triad(+oct)
PROG = [(45, [57, 60, 64, 69]),   # Am
        (41, [53, 57, 60, 65]),   # F
        (36, [48, 52, 55, 60]),   # C
        (43, [55, 59, 62, 67])]   # G

def env(n, a, d, s=0.0):
    e = np.empty(n); ai = max(1, int(a * SR))
    ai = min(ai, n)
    e[:ai] = np.linspace(0, 1, ai) ** 1.6
    if n > ai:
        e[ai:] = np.exp(-np.arange(n - ai) / (d * SR)) * (1 - s) + s
    return e

def saw(f, n, t0=0.0):
    x = np.arange(n) / SR + t0
    return 2 * (x * f - np.floor(0.5 + x * f))

def add(buf, start, sig):
    i = int(start * SR); j = min(len(buf), i + len(sig))
    if i < len(buf) and j > i: buf[i:j] += sig[:j - i]

def smooth(x, k):
    """cheap lowpass — moving average, vectorised"""
    ker = np.ones(k) / k
    return np.convolve(x, ker, mode='same')

chords = np.zeros(N); melody = np.zeros(N); vocals = np.zeros(N)

# accent pattern in eighths: which subdivisions re-articulate, and how hard
ACC = {0: 1.00, 3: 0.55, 4: 0.80, 6: 0.45}

for rep in range(REPS):
    base = rep * BAR * BARS
    for ci, (root, triad) in enumerate(PROG):
        cs = base + ci * BAR * 2

        # ---- chords: sustained, re-articulated on an accent pattern ----
        for bar in range(2):
            for eighth, amp in ACC.items():
                st = cs + bar * BAR + eighth * BEAT / 2
                L  = BAR * 0.9
                n  = int(L * SR)
                e  = env(n, 0.035, 1.4, 0.18) * amp
                sig = np.zeros(n)
                for m in [root] + triad:
                    sig += saw(hz(m), n) * (0.5 if m == root else 0.28)
                add(chords, st, smooth(sig, 26) * e * 0.20)

        # ---- melody: slow minor line ----
        PENT = [69, 72, 74, 76, 79, 81]
        rng = np.random.default_rng(31 + ci * 5 + rep * 11)
        pos = 0.0
        while pos < BAR * 2 - 0.3:
            L = float(rng.choice([BEAT, BEAT * 1.5, BEAT * 2, BEAT * 2]))
            if rng.random() < 0.30:
                pos += L; continue
            m  = int(PENT[rng.integers(0, len(PENT))])
            ln = min(L * 0.95, BAR * 2 - pos)
            n  = int(ln * SR)
            e  = env(n, 0.09, 1.1, 0.35)
            x  = np.arange(n) / SR
            vib = 1 + 0.005 * np.sin(2 * np.pi * 4.6 * x)
            sig = (np.sin(2 * np.pi * hz(m) * x * vib) * 0.6
                 + np.sin(2 * np.pi * hz(m + 12) * x) * 0.16
                 + saw(hz(m), n) * 0.18)
            add(melody, cs + pos, sig * e * 0.26)
            pos += L

        # ---- vocals: layered, wordless, very slow attack ----
        L = BAR * 2 * 0.99
        n = int(L * SR)
        e = env(n, 0.9, 4.0, 0.55) * np.hanning(n) ** 0.35
        x = np.arange(n) / SR
        voice = np.zeros(n)
        for k, m in enumerate(triad[1:]):
            for det in (-0.14, 0.0, 0.14):
                f = hz(m + 12) + det
                voice += (np.sin(2 * np.pi * f * x) * 0.5
                        + np.sin(2 * np.pi * f * 2 * x) * 0.10
                        + np.sin(2 * np.pi * f * 3 * x) * 0.05)
        voice /= 9.0
        add(vocals, cs, smooth(voice, 8) * e * 0.42)

# ---- reverb: multi-tap smear of everything else, sitting behind it ----
src = chords * 0.6 + melody * 0.55 + vocals * 0.75
reverb = np.zeros(N)
rng = np.random.default_rng(7)
TAPS, SPREAD, RT = 30, 2.4, 1.5
for i in range(TAPS):
    d = 0.055 + SPREAD * (i / TAPS) ** 1.25 + rng.uniform(0, 0.02)
    g = np.exp(-d / RT) * (0.9 if i % 2 else 1.0) / (TAPS ** 0.5)
    off = int(d * SR)
    if off < N: reverb[off:] += src[:N - off] * g
reverb = smooth(reverb, 60)

def write(path, buf, name):
    peak = float(np.max(np.abs(buf))) or 1.0
    rms  = float(np.sqrt(np.mean(buf ** 2)))
    d = (buf / peak * 0.80 * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(d.tobytes())
    print(f"  {name:8s} peak {peak:5.2f}  rms {rms:.4f}")

out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/stemwork"
os.makedirs(out, exist_ok=True)
print(f"synthesising {N/SR:.1f}s @ {SR} Hz mono — A minor, {BPM} BPM")
for nm, b in (("chords", chords), ("melody", melody), ("reverb", reverb), ("vocals", vocals)):
    write(os.path.join(out, nm + ".wav"), b, nm)
print("done")
