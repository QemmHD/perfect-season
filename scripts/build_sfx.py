"""Build the arcade games' recorded sound effects (needs ffmpeg and numpy).

Every sound is cut from free recordings: Mixkit (Mixkit Sound Effects Free License: free for
commercial use in games, no attribution needed, not to be redistributed on its own) and Kenney's
Impact Sounds (CC0). The raw downloads are kept in .cache/sounds (git-ignored) and fetched again
when missing. Each output is trimmed, layered where a recipe says so, faded, made mono, levelled
and encoded as a small MP3 in src/assets/sfx/, which src/lib/sound.ts imports (Vite gives them
hashed names and the service worker precaches them).

    python3 scripts/build_sfx.py            # build everything, rewrite the credits table
    python3 scripts/build_sfx.py swish rim  # just these

Levels: one-shots are peak-normalized to -1 dBFS (sound.ts sets each one's playback gain); the
crowd loops sit at -20 dBFS RMS and the crowd reactions at -16 dBFS RMS (peaks kept under -1 dBFS).
Loops are 10 s long with a crossfaded seam, followed by a copy of their first 0.6 s, so the player
can loop 0.3 s .. 10.3 s cleanly whatever priming silence an MP3 decoder leaves at the start.
"""
import os, re, subprocess, sys, tempfile, urllib.request, wave, zipfile
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.environ.get('PS_SOUND_CACHE') or os.path.join(ROOT, '.cache', 'sounds')
OUT = os.path.join(ROOT, 'src', 'assets', 'sfx')
CREDITS = os.path.join(ROOT, 'docs', 'CREDITS.md')
SR = 44100
UA = 'perfect-season-build/1.0'

MIXKIT_LICENSE = 'Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree)'
KENNEY_LICENSE = 'CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/)'

# id -> (title, author) on Mixkit. The page is https://mixkit.co/free-sound-effects/discover/<slug>-<id>/,
# the file https://assets.mixkit.co/active_storage/sfx/<id>/<id>.wav
MIXKIT = {
    364: 'Big crowd talking loop',
    2097: 'Ambient sports crowd sound',
    459: 'Male crowd cheering short',
    362: 'Stadium crowd light applause',
    2111: 'Crowd at the stadium',
    462: 'Huge crowd cheering victory',
    2110: 'Crowd yelling at stadium',
    463: 'Crowd disappointment long boo',
    469: 'People moaning sadly',
    1009: 'Rubber squeaking',
    1013: 'Rubber fast squeak',
    394: 'Basketball falling indoor',
    2076: 'Basketball ball bouncing in the floor',
    2084: 'Basketball ball hitting the net',
    2093: 'Basketball ball, hard hit',
    2091: 'Basketball ball hit',
    2081: 'Catching a basketball ball',
    2090: 'Hand receiving a basketball',
    615: 'Police short whistle',
    1647: 'Basketball buzzer',
    1654: 'Distant train horn',
    2099: 'Soccer ball kick',
    2143: 'Hard and quick punch',
    2153: 'Body punch quick hit',
    2150: 'Impact of a blow',
    2182: 'Wood hard hit',
    2498: 'Body impact falling into the sand',
}
KENNEY_ZIP = 'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip'
KENNEY_PAGE = 'https://kenney.nl/assets/impact-sounds'


def mixkit_page(i):
    slug = re.sub(r'[^a-z0-9]+', '-', MIXKIT[i].lower()).strip('-')
    return f'https://mixkit.co/free-sound-effects/discover/{slug}-{i}/'


def fetch(url, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r, open(path + '.part', 'wb') as f:
        f.write(r.read())
    os.replace(path + '.part', path)


def source(name):
    """Local path of a source: 'mixkit:2084' or 'kenney:impactMetal_heavy_000'."""
    kind, key = name.split(':')
    if kind == 'mixkit':
        p = os.path.join(CACHE, 'mixkit', key + '.wav')
        if not os.path.exists(p):
            fetch(f'https://assets.mixkit.co/active_storage/sfx/{key}/{key}.wav', p)
        return p
    p = os.path.join(CACHE, 'kenney', 'impact', 'Audio', key + '.ogg')
    if not os.path.exists(p):
        z = os.path.join(CACHE, 'kenney', 'kenney_impact-sounds.zip')
        if not os.path.exists(z):
            fetch(KENNEY_ZIP, z)
        with zipfile.ZipFile(z) as zf:
            for n in zf.namelist():
                if n.startswith('/') or '..' in n:
                    raise SystemExit('bad path in zip: ' + n)
            zf.extractall(os.path.join(CACHE, 'kenney', 'impact'))
    return p


def load(name, start=0.0, end=None, af=None):
    cmd = ['ffmpeg', '-v', 'error', '-ss', str(start)]
    if end is not None:
        cmd += ['-to', str(end)]
    cmd += ['-i', source(name), '-ac', '1', '-ar', str(SR)]
    if af:
        cmd += ['-af', af]
    cmd += ['-f', 'f32le', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype='<f4').astype(np.float64)


def fade(x, fin=0.003, fout=0.03, shape=2.0):
    x = x.copy()
    a = int(fin * SR)
    b = int(fout * SR)
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b) ** shape
    return x


def envelope(x, points):
    """Multiply by a piecewise-linear gain curve [(seconds, gain), ...]."""
    t = np.arange(len(x)) / SR
    ts, gs = zip(*points)
    return x * np.interp(t, ts, gs)


def varispeed(x, points):
    """Tape-style speed (and pitch) change following [(output seconds, rate), ...]."""
    out_len = int(len(x) / np.mean([p[1] for p in points]) * 1.2)
    t = np.arange(out_len) / SR
    ts, rs = zip(*points)
    pos = np.cumsum(np.interp(t, ts, rs))
    pos = pos[pos < len(x) - 1]
    return np.interp(pos, np.arange(len(x)), x)


def mix(*layers):
    """layers: (signal, gain_db, delay_seconds)"""
    n = max(len(s) + int(d * SR) for s, _, d in layers)
    y = np.zeros(n)
    for s, g, d in layers:
        o = int(d * SR)
        y[o: o + len(s)] += s * 10 ** (g / 20)
    return y


def trim_tail(x, db=-60):
    lim = np.abs(x).max() * 10 ** (db / 20)
    idx = np.nonzero(np.abs(x) > lim)[0]
    return x[: idx[-1] + 1] if len(idx) else x


def trim_head(x, db=-36, keep=0.002):
    """Start right at the sound (so it plays the moment it's called), keeping a couple of ms before it."""
    lim = np.abs(x).max() * 10 ** (db / 20)
    i = max(0, int(np.argmax(np.abs(x) > lim)) - int(keep * SR))
    y = x[i:].copy()
    n = min(len(y), int(keep * SR))
    y[:n] *= np.linspace(0, 1, n)
    return y


def peak_norm(x, db=-1.0):
    return x * (10 ** (db / 20) / np.abs(x).max())


def rms_norm(x, db, peak_db=-1.0):
    rms = np.sqrt(np.mean(x ** 2))
    y = x * (10 ** (db / 20) / rms)
    lim = 10 ** (peak_db / 20)
    over = np.abs(y) > lim * 0.7
    if over.any():
        # soft-knee limiter above 70% of the ceiling
        k = lim * 0.7
        s = np.sign(y[over])
        a = np.abs(y[over]) - k
        y[over] = s * (k + (lim - k) * np.tanh(a / (lim - k)))
    return y


def loopify(x, length=10.0, xfade=1.5, head=0.6):
    """A seamless loop of `length` seconds from x (needs length + xfade), plus `head` seconds of its start again."""
    L = int(length * SR)
    X = int(xfade * SR)
    s = x[: L + X]
    c = s[X: L + X].copy()
    u = np.linspace(0, 1, X)
    # equal-power crossfade from the source's continuation into its beginning, landing on c[0]
    c[L - X:] = s[L: L + X] * np.cos(u * np.pi / 2) + s[0:X] * np.sin(u * np.pi / 2)
    return np.concatenate([c, c[: int(head * SR)]])


def reverb(x, wet_db=-12, room=(0.023, 0.041, 0.067, 0.097), decay=0.45):
    """A few early reflections: a little room on dry recordings."""
    y = x.copy()
    g = 10 ** (wet_db / 20)
    for i, d in enumerate(room):
        o = int(d * SR)
        y[o:] += x[: len(x) - o] * g * decay ** i
    return y


# ---- recipes: name -> (build function, kind, bitrate kbps, sources used) ----

def r_crowd_arena():
    murmur = load('mixkit:364', 20.0, 32.0, af='highpass=f=120,lowpass=f=7000')
    roar = load('mixkit:2097', 20.0, 32.0, af='highpass=f=150,lowpass=f=7000')
    x = reverb(mix((murmur, 0, 0), (roar, -9, 0)), -10)
    return rms_norm(loopify(x), -20)


def r_crowd_stadium():
    roar = load('mixkit:2097', 30.0, 42.0, af='highpass=f=90,lowpass=f=8000')
    murmur = load('mixkit:364', 35.0, 47.0, af='highpass=f=150,lowpass=f=6000')
    return rms_norm(loopify(mix((roar, 0, 0), (murmur, -12, 0))), -20)


def r_cheer_arena():
    voices = load('mixkit:459', 0.0, 4.2)
    claps = load('mixkit:362', 2.0, 6.2)
    x = reverb(mix((voices, 0, 0), (claps, -4, 0.05)), -11)
    x = envelope(x, [(0, 1), (2.2, 1), (4.1, 0.0)])
    return rms_norm(fade(trim_tail(x), 0.02, 0.4), -16)


def r_cheer_stadium():
    x = load('mixkit:2111', 0.0, 4.0, af='highpass=f=80')
    x = envelope(x, [(0, 1), (2.0, 0.9), (3.95, 0.0)])
    return rms_norm(fade(x, 0.05, 0.3), -16)


def r_roar_arena():
    x = load('mixkit:462', 0.25, 5.6)
    x = reverb(envelope(x, [(0, 1), (2.8, 1), (5.3, 0.0)]), -12)
    return rms_norm(fade(trim_tail(x), 0.03, 0.3), -16)


def r_roar_stadium():
    x = load('mixkit:2110', 0.0, 6.0, af='highpass=f=70')
    x = envelope(x, [(0, 1), (3.5, 0.75), (5.95, 0.0)])
    return rms_norm(fade(x, 0.05, 0.3), -16)


def r_ooh():
    # a crowd's "oooh": the long boo's "oo" vowel, swelling and lifting in pitch, then falling away
    x = load('mixkit:463', 2.0, 5.0, af='highpass=f=120')
    x = varispeed(x, [(0, 1.0), (0.45, 1.12), (1.0, 1.06), (2.0, 0.98)])
    x = envelope(x, [(0, 0.15), (0.35, 1.0), (0.75, 0.85), (1.9, 0.0)])
    return rms_norm(fade(x[: int(2.0 * SR)], 0.02, 0.2), -16)


def r_groan():
    # a crowd's "awww": voices moaning, falling in pitch and dying away
    x = load('mixkit:469', 11.0, 14.5, af='highpass=f=120')
    x = varispeed(x, [(0, 1.05), (0.5, 1.0), (2.4, 0.86)])
    x = envelope(x, [(0, 0.2), (0.22, 1.0), (0.8, 0.8), (2.3, 0.0)])
    return rms_norm(fade(x[: int(2.4 * SR)], 0.02, 0.2), -16)


def r_squeak(i, start, end):
    return lambda: peak_norm(fade(load('mixkit:' + str(i), start, end), 0.004, 0.035))


def r_dribble(src, start, end):
    return lambda: peak_norm(fade(trim_tail(load(src, start, end), -50), 0.002, 0.08))


def r_swish():
    return peak_norm(fade(trim_tail(load('mixkit:2084', 0.12, 0.72), -50), 0.004, 0.12))


def r_rim(ball, ring, ring_db):
    def f():
        b = load(ball[0], ball[1], ball[1] + 0.4)
        r = load(ring, 0, None)
        return peak_norm(fade(trim_tail(mix((b, 0, 0), (r, ring_db, 0.004)), -50), 0.002, 0.1))
    return f


def r_backboard():
    b = load('mixkit:2093', 0.09, 0.5)
    p = load('kenney:impactPlate_heavy_000', 0, None)
    return peak_norm(fade(trim_tail(mix((b, 0, 0), (p, -3, 0.002)), -50), 0.002, 0.1))


def r_dunk():
    clang = load('kenney:impactMetal_heavy_000', 0, None)
    shake = load('kenney:impactPlate_medium_001', 0, None)
    ball = load('mixkit:2093', 0.09, 0.5)
    net = load('mixkit:2084', 0.12, 0.8)
    x = mix((ball, -2, 0), (clang, -3, 0.002), (shake, -9, 0.01), (net, -1, 0.05))
    return peak_norm(fade(trim_tail(x, -50), 0.002, 0.15))


def r_catch(i, start, end):
    return lambda: peak_norm(fade(trim_tail(load('mixkit:' + str(i), start, end), -48), 0.002, 0.06))


def r_whistle():
    x = load('mixkit:615', 0.02, 1.0)
    return peak_norm(fade(trim_tail(x, -45), 0.004, 0.25))


def r_buzzer():
    x = load('mixkit:1647', 0.0, 2.4)
    x = envelope(x, [(0, 1), (1.4, 1), (2.35, 0.0)])
    return peak_norm(fade(x, 0.005, 0.1))


def r_horn():
    x = load('mixkit:1654', 0.0, 2.9, af='highpass=f=60')
    x = envelope(x, [(0, 1), (1.9, 1), (2.85, 0.0)])
    return peak_norm(fade(x, 0.01, 0.1))


def r_kick():
    return peak_norm(fade(trim_tail(load('mixkit:2099', 0.15, 0.75), -50), 0.002, 0.1))


def r_hit1():
    core = load('mixkit:2153', 0.02, 0.4)
    low = load('kenney:impactSoft_heavy_001', 0, None)
    return peak_norm(fade(trim_tail(mix((core, 0, 0), (low, -6, 0.004)), -50), 0.002, 0.08))


def r_hit2():
    core = load('mixkit:2143', 0.015, 0.45)
    low = load('kenney:impactPunch_heavy_000', 0, None)
    return peak_norm(fade(trim_tail(mix((core, 0, 0), (low, -4, 0.002)), -50), 0.002, 0.1))


def r_hit3():
    core = load('mixkit:2143', 0.015, 0.45)
    boom = load('mixkit:2150', 0.1, 0.62, af='lowpass=f=1500')
    crack = load('mixkit:2182', 0.05, 0.35)
    low = load('kenney:impactPunch_heavy_002', 0, None)
    x = mix((core, 0, 0), (boom, -2, 0.0), (crack, -9, 0.003), (low, -5, 0.002))
    return peak_norm(fade(trim_tail(x, -50), 0.002, 0.12))


def r_thud():
    body = load('mixkit:2498', 0.13, 0.7, af='lowpass=f=2400')
    low = load('kenney:impactSoft_heavy_000', 0, None)
    return peak_norm(fade(trim_tail(mix((body, 0, 0), (low, -4, 0.0)), -50), 0.002, 0.1))


RECIPES = {
    # name: (fn, kind, kbps, sources)
    'crowd-arena': (r_crowd_arena, 'loop', 64, ['mixkit:364', 'mixkit:2097']),
    'crowd-stadium': (r_crowd_stadium, 'loop', 64, ['mixkit:2097', 'mixkit:364']),
    'cheer-arena': (r_cheer_arena, 'crowd', 80, ['mixkit:459', 'mixkit:362']),
    'cheer-stadium': (r_cheer_stadium, 'crowd', 80, ['mixkit:2111']),
    'roar-arena': (r_roar_arena, 'crowd', 80, ['mixkit:462']),
    'roar-stadium': (r_roar_stadium, 'crowd', 80, ['mixkit:2110']),
    'ooh': (r_ooh, 'crowd', 80, ['mixkit:463']),
    'groan': (r_groan, 'crowd', 80, ['mixkit:469']),
    'squeak-1': (r_squeak(1009, 3.655, 3.86), 'shot', 96, ['mixkit:1009']),
    'squeak-2': (r_squeak(1009, 5.265, 5.44), 'shot', 96, ['mixkit:1009']),
    'squeak-3': (r_squeak(1009, 0.893, 1.075), 'shot', 96, ['mixkit:1009']),
    'squeak-4': (r_squeak(1013, 0.555, 0.69), 'shot', 96, ['mixkit:1013']),
    'dribble-1': (r_dribble('mixkit:394', 0.125, 0.47), 'shot', 96, ['mixkit:394']),
    'dribble-2': (r_dribble('mixkit:394', 0.519, 0.86), 'shot', 96, ['mixkit:394']),
    'dribble-3': (r_dribble('mixkit:2076', 0.0, 0.42), 'shot', 96, ['mixkit:2076']),
    'swish': (r_swish, 'shot', 96, ['mixkit:2084']),
    'rim-1': (r_rim(('mixkit:2093', 0.09), 'kenney:impactMetal_heavy_000', -3), 'shot', 96, ['mixkit:2093', 'kenney:impactMetal_heavy_000']),
    'rim-2': (r_rim(('mixkit:2091', 0.11), 'kenney:impactMetal_medium_000', -5), 'shot', 96, ['mixkit:2091', 'kenney:impactMetal_medium_000']),
    'backboard': (r_backboard, 'shot', 96, ['mixkit:2093', 'kenney:impactPlate_heavy_000']),
    'dunk': (r_dunk, 'shot', 96, ['mixkit:2093', 'mixkit:2084', 'kenney:impactMetal_heavy_000', 'kenney:impactPlate_medium_001']),
    'catch-1': (r_catch(2081, 0.1, 0.45), 'shot', 96, ['mixkit:2081']),
    'catch-2': (r_catch(2090, 0.1, 0.42), 'shot', 96, ['mixkit:2090']),
    'whistle': (r_whistle, 'shot', 96, ['mixkit:615']),
    'buzzer': (r_buzzer, 'shot', 96, ['mixkit:1647']),
    'horn': (r_horn, 'shot', 96, ['mixkit:1654']),
    'kick': (r_kick, 'shot', 96, ['mixkit:2099']),
    'hit-1': (r_hit1, 'shot', 96, ['mixkit:2153', 'kenney:impactSoft_heavy_001']),
    'hit-2': (r_hit2, 'shot', 96, ['mixkit:2143', 'kenney:impactPunch_heavy_000']),
    'hit-3': (r_hit3, 'shot', 96, ['mixkit:2143', 'mixkit:2150', 'mixkit:2182', 'kenney:impactPunch_heavy_002']),
    'thud': (r_thud, 'shot', 96, ['mixkit:2498', 'kenney:impactSoft_heavy_000']),
}


def encode(x, path, kbps):
    x = np.clip(x, -1, 1)
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, 'x.wav')
        with wave.open(w, 'wb') as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(SR)
            f.writeframes((x * 32767).astype('<i2').tobytes())
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', w, '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', f'{kbps}k',
                        '-ac', '1', '-ar', str(SR), '-id3v2_version', '0', '-write_id3v1', '0', path], check=True)


def credits():
    used = {}
    for name, (_, _, _, srcs) in RECIPES.items():
        for s in srcs:
            used.setdefault(s, []).append(name)
    rows = []
    # Mixkit's by number, then Kenney's by file
    for s in sorted(used, key=lambda k: (k.startswith('kenney'), int(k[7:]) if k.startswith('mixkit') else 0, k)):
        kind, key = s.split(':')
        if kind == 'mixkit':
            i = int(key)
            rows.append(f'| {", ".join(used[s])} | "{MIXKIT[i]}" (Mixkit #{i}) | Mixkit | {mixkit_page(i)} | {MIXKIT_LICENSE} |')
        else:
            rows.append(f'| {", ".join(used[s])} | {key}.ogg from Impact Sounds | Kenney (kenney.nl) | {KENNEY_PAGE} | {KENNEY_LICENSE} |')
    table = '\n'.join([
        '<!-- sounds:start (written by scripts/build_sfx.py) -->',
        '| Our files (src/assets/sfx/*.mp3) | Recording | Author | Source | License |',
        '| --- | --- | --- | --- | --- |',
        *rows,
        '<!-- sounds:end -->',
    ])
    text = open(CREDITS).read() if os.path.exists(CREDITS) else ''
    if '<!-- sounds:start' in text:
        text = re.sub(r'<!-- sounds:start.*?<!-- sounds:end -->', lambda _: table, text, flags=re.S)
    else:
        intro = (
            '## Sounds\n\n'
            'The arcade games\' sounds are real recordings: cut, layered, levelled and made mono by\n'
            '`scripts/build_sfx.py` (its RECIPES say exactly which part of which recording each file is).\n'
            'Mixkit\'s license allows free use in commercial games without attribution (credit given anyway);\n'
            'the recordings may not be redistributed on their own, outside the app. Kenney\'s are public domain (CC0).\n'
            'The menus\' clicks, coins and card sounds are still synthesized in `src/lib/sound.ts`.\n\n'
        )
        text = (text.rstrip() + '\n\n' if text.strip() else '# Credits\n\n') + intro + table + '\n'
    with open(CREDITS, 'w') as f:
        f.write(text)


def main():
    only = sys.argv[1:]
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name, (fn, kind, kbps, _) in RECIPES.items():
        path = os.path.join(OUT, name + '.mp3')
        if not only or name in only:
            x = fn()
            if kind == 'shot':
                x = trim_head(x)
            encode(x, path, kbps)
            print(f'{name:15} {kind:6} {len(x)/SR:5.2f}s  peak {20*np.log10(np.abs(x).max()):5.1f} dBFS  rms {20*np.log10(np.sqrt(np.mean(x**2))):5.1f}  {os.path.getsize(path)//1024:4d} KB')
        total += os.path.getsize(path)
    stale = [f for f in os.listdir(OUT) if f.endswith('.mp3') and f[:-4] not in RECIPES]
    for f in stale:
        os.remove(os.path.join(OUT, f))
    print(f'total {total/1024:.0f} KB in {len(RECIPES)} files' + (f' (removed {stale})' if stale else ''))
    credits()


if __name__ == '__main__':
    main()
