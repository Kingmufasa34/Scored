"""Synthesise the room sounds and foley for the table read: no samples, no licences.

Beds loop under a whole scene (room tone, the clock, rain, strip lights and the
vending machine). One-shots are placed on actions by the sound sheet
(<episode>/performance/<draft>-sounds.json).

Usage: python3 make_sfx.py OUT_DIR
Writes OUT_DIR/<name>.mp3 for every sound below.
"""
import os
import subprocess
import sys

import numpy as np

SR = 44100
rng = np.random.default_rng(7)


def t(sec):
    return np.arange(int(sec * SR)) / SR


def noise(sec):
    return rng.standard_normal(int(sec * SR)).astype(np.float32)


def lp_fast(x, hz):
    # FFT brick-ish low-pass for long beds
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / hz) ** 4)
    return np.fft.irfft(X, len(x)).astype(np.float32)


def bp_fast(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= (1 / (1 + (lo / np.maximum(f, 1)) ** 4)) * (1 / (1 + (f / hi) ** 4))
    return np.fft.irfft(X, len(x)).astype(np.float32)


def env(n, attack, decay):
    k = np.arange(n) / SR
    e = np.minimum(1, k / max(attack, 1e-4)) * np.exp(-k / decay)
    return e.astype(np.float32)


def modes(sec, freqs, decays, amps):
    """Struck object: a few damped resonances."""
    k = t(sec)
    out = np.zeros_like(k)
    for f, d, a in zip(freqs, decays, amps):
        out += a * np.sin(2 * np.pi * f * k + rng.uniform(0, 6)) * np.exp(-k / d)
    return out.astype(np.float32)


def place(dst, src, at):
    i = max(0, int(at * SR))
    j = min(len(dst), i + len(src))
    if i < len(dst):
        dst[i:j] += src[: j - i]


def norm(x, peak=0.8):
    return (x / (np.max(np.abs(x)) or 1) * peak).astype(np.float32)


def loopable(x, fade=1.0):
    """Crossfade the tail into the head so the bed loops without a seam."""
    n = int(fade * SR)
    head, tail = x[:n].copy(), x[-n:]
    w = np.linspace(0, 1, n, dtype=np.float32)
    x = x[: len(x) - n].copy()
    x[:n] = head * w + tail * (1 - w)
    return x


# ---------- one-shots ----------

def click(freq=3500, dec=0.004, level=1.0):
    n = int(0.06 * SR)
    c = noise(0.06) * env(n, 0.0002, dec * 0.6)
    c = bp_fast(c, freq * 0.5, freq * 1.8)
    return norm(c + modes(0.06, [freq, freq * 1.6], [dec, dec * 0.7], [0.4, 0.2]), level)


def pen_click():
    a = click(4200, 0.004)
    b = click(3000, 0.003, 0.7)
    out = np.zeros(int(0.25 * SR), dtype=np.float32)
    place(out, a, 0.0)
    place(out, b, 0.09)
    return norm(out, 0.6)


def lid_click():
    return norm(click(2600, 0.006) * 0.9 + click(5200, 0.002) * 0.4, 0.55)


def tap(freq=900, dec=0.03):
    body = modes(0.25, [freq, freq * 2.3, freq * 3.9], [dec, dec * 0.6, dec * 0.4], [1, 0.5, 0.25])
    hit = bp_fast(noise(0.25) * env(int(0.25 * SR), 0.0003, 0.006), 800, 6000)
    return norm(body + hit * 0.6, 0.6)


def pen_taps():
    out = np.zeros(int(2.4 * SR), dtype=np.float32)
    for k, at in enumerate([0.0, 0.42, 0.8, 1.25, 1.62, 2.05]):
        place(out, tap(1100 + 40 * (k % 2), 0.02) * (0.8 + 0.2 * (k % 2)), at)
    return norm(out, 0.5)


def paper(sec, lo=1500, hi=9000, grit=40):
    n = int(sec * SR)
    x = noise(sec)
    crackle = (rng.random(n) < grit / SR).astype(np.float32) * rng.uniform(0.5, 1.5, n).astype(np.float32)
    crackle = np.convolve(crackle, np.exp(-np.arange(200) / 30), "same").astype(np.float32)
    x = bp_fast(x * 0.4 + crackle * rng.standard_normal(n).astype(np.float32), lo, hi)
    return x


def page_flip():
    n = int(0.55 * SR)
    swish = paper(0.55, 900, 7000, 120)
    e = np.sin(np.linspace(0, np.pi, n)) ** 2
    e[int(0.4 * n):] *= np.linspace(1, 0.2, n - int(0.4 * n))
    snap = bp_fast(noise(0.55) * env(n, 0.0005, 0.01), 2000, 9000)
    out = swish * e
    place(out, snap * 0.6, 0.38)
    return norm(out, 0.5)


def paper_rustle(sec=1.2):
    n = int(sec * SR)
    x = paper(sec, 1200, 8000, 260)
    am = lp_fast(np.abs(noise(sec)), 6) * 3
    return norm(x * am * np.sin(np.linspace(0, np.pi, n)) ** 0.5, 0.4)


def scribble(sec=1.8):
    n = int(sec * SR)
    x = bp_fast(noise(sec), 2500, 9000)
    k = t(sec)
    strokes = (0.5 + 0.5 * np.sin(2 * np.pi * (6 + 2 * np.sin(2 * np.pi * 0.7 * k)) * k)) ** 3
    lifts = (lp_fast(rng.random(n).astype(np.float32), 2) > 0.48).astype(np.float32)
    lifts = lp_fast(lifts, 30)
    return norm(x * strokes * lifts, 0.25)


def scribble_out():
    k = t(1.1)
    x = bp_fast(noise(1.1), 1800, 7000)
    strokes = np.abs(np.sin(2 * np.pi * 7 * k)) ** 2
    return norm(x * strokes * np.sin(np.linspace(0, np.pi, len(k))), 0.35)


def peel():
    # satsuma peel: wet, slow, small tearing crackles
    sec = 2.2
    n = int(sec * SR)
    pops = (rng.random(n) < 900 / SR).astype(np.float32) * rng.uniform(0.2, 1, n).astype(np.float32)
    pops = np.convolve(pops, np.exp(-np.arange(80) / 12), "same").astype(np.float32)
    x = bp_fast(pops * rng.standard_normal(n).astype(np.float32) + noise(sec) * 0.05, 1500, 8000)
    e = lp_fast((rng.random(n) > 0.3).astype(np.float32), 3)
    return norm(x * e, 0.3)


def thump(freq=70, dec=0.12, level=0.9):
    k = t(0.6)
    f = freq * (1 + 0.6 * np.exp(-k / 0.02))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-k / dec)
    hit = lp_fast(noise(0.6) * env(len(k), 0.0005, 0.015), 1500)
    return norm(body + hit * 0.5, level)


def palm_slap_glass():
    n = int(1.2 * SR)
    slap = bp_fast(noise(1.2) * env(n, 0.0003, 0.012), 400, 6000)
    glass = modes(1.2, [610, 1180, 1730, 2650, 3900], [0.25, 0.18, 0.12, 0.08, 0.05], [0.5, 0.35, 0.3, 0.2, 0.1])
    rattle = bp_fast(noise(1.2) * env(n, 0.002, 0.08), 2000, 5000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 37 * t(1.2))))
    out = slap * 1.2 + glass * 0.6 + rattle * 0.25
    place(out, thump(95, 0.08, 0.7), 0)
    return norm(out, 0.85)


def fist_bang_glass(hard=1.0):
    n = int(1.6 * SR)
    hit = lp_fast(noise(1.6) * env(n, 0.0003, 0.02), 2500)
    glass = modes(1.6, [540, 1090, 1610, 2480, 3600], [0.35, 0.25, 0.15, 0.1, 0.06], [0.6, 0.4, 0.35, 0.2, 0.1])
    panel = modes(1.6, [120, 185, 260], [0.25, 0.18, 0.12], [1, 0.6, 0.4])
    rattle = bp_fast(noise(1.6) * env(n, 0.003, 0.15), 1500, 5000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 29 * t(1.6))))
    out = hit + glass * 0.5 + panel * 0.9 + rattle * 0.35
    place(out, thump(65, 0.14, 1.0), 0)
    return norm(out, 0.95 * hard)


def forehead_glass():
    n = int(0.8 * SR)
    return norm(lp_fast(noise(0.8) * env(n, 0.004, 0.03), 700) + modes(0.8, [560, 1120], [0.15, 0.1], [0.2, 0.1]), 0.35)


def coin_clink():
    return norm(modes(0.9, [3100, 5300, 7400, 9800], [0.25, 0.18, 0.12, 0.08], [1, 0.6, 0.4, 0.25]), 0.35)


def coin_insert():
    out = np.zeros(int(1.6 * SR), dtype=np.float32)
    place(out, click(4500, 0.003, 0.5), 0.0)
    for k, at in enumerate([0.25, 0.42, 0.55, 0.66, 0.74, 0.8]):
        place(out, modes(0.3, [2400 + 300 * k, 4100 + 200 * k], [0.04, 0.03], [1, 0.5]) * (1 - k * 0.12), at)
    place(out, thump(180, 0.04, 0.4), 0.95)
    return norm(out, 0.5)


def spiral_motor(sec=2.4):
    k = t(sec)
    f = 48 + 4 * np.sin(2 * np.pi * 0.8 * k)
    saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
    whine = np.sin(2 * np.pi * 380 * k) * 0.15
    x = lp_fast(saw.astype(np.float32), 900) + whine + bp_fast(noise(sec), 300, 2000) * 0.15
    e = np.minimum(1, k / 0.15) * np.minimum(1, (sec - k) / 0.1)
    out = x * e
    place(out, click(1800, 0.01, 0.6), sec - 0.12)  # the clunk when it stops
    return norm(out, 0.45)


def crisp_packet(sec=1.4, density=1800):
    n = int(sec * SR)
    pops = (rng.random(n) < density / SR).astype(np.float32) * rng.uniform(0.2, 1, n).astype(np.float32)
    pops = np.convolve(pops, np.exp(-np.arange(60) / 8), "same").astype(np.float32)
    x = bp_fast(pops * rng.standard_normal(n).astype(np.float32), 1500, 12000)
    e = lp_fast((rng.random(n) > 0.4).astype(np.float32), 5)
    return norm(x * e, 0.45)


def packet_drop():
    out = np.zeros(int(1.2 * SR), dtype=np.float32)
    place(out, crisp_packet(0.25, 2500), 0.0)
    place(out, thump(140, 0.05, 0.6), 0.22)
    place(out, crisp_packet(0.4, 1500) * 0.6, 0.24)
    return norm(out, 0.6)


def crisp_open():
    out = crisp_packet(0.9, 2500)
    pop = thump(300, 0.02, 0.5)
    place(out, pop, 0.55)
    return norm(out, 0.55)


def crunch():
    out = np.zeros(int(1.6 * SR), dtype=np.float32)
    for at in [0.0, 0.35, 0.62, 0.9, 1.2]:
        c = bp_fast(noise(0.15) * env(int(0.15 * SR), 0.001, 0.04), 800, 7000)
        place(out, c, at)
    return norm(out, 0.3)


def step(soft=False):
    k = 0.35
    heel = thump(85 if soft else 110, 0.05, 0.8)[: int(k * SR)]
    scuff = bp_fast(noise(k) * env(int(k * SR), 0.01, 0.05), 400, 3000) * (0.2 if soft else 0.35)
    out = heel + scuff
    place(out, thump(140, 0.03, 0.4)[: int(0.2 * SR)], 0.08)
    return norm(out, 0.4 if soft else 0.55)


def footsteps(n=5, gap=0.55, soft=False, fade_out=False):
    out = np.zeros(int((n * gap + 0.5) * SR), dtype=np.float32)
    for k in range(n):
        g = (1 - k / n * 0.8) if fade_out else 1
        place(out, step(soft) * g * rng.uniform(0.8, 1.0), k * gap + rng.uniform(-0.03, 0.03))
    return out


def stairs():
    return norm(lp_fast(footsteps(8, 0.42, fade_out=True), 1800), 0.4)


def creak(sec=0.9, f0=180):
    k = t(sec)
    f = f0 * (1 + 0.25 * np.sin(2 * np.pi * 1.3 * k)) + 20 * rng.standard_normal(len(k)).cumsum() / np.sqrt(len(k))
    pulses = ((np.cumsum(f) / SR) % 1 < 0.08).astype(np.float32)
    x = bp_fast(pulses * (0.6 + 0.4 * rng.random(len(k))).astype(np.float32), 300, 3000)
    return norm(x * np.sin(np.linspace(0, np.pi, len(k))), 0.3)


def door_open():
    out = np.zeros(int(1.8 * SR), dtype=np.float32)
    place(out, click(1500, 0.02, 0.6), 0.0)  # handle
    place(out, click(900, 0.03, 0.5), 0.12)  # latch
    place(out, creak(1.1, 140) * 0.7, 0.3)
    return norm(out, 0.5)


def door_close():
    out = np.zeros(int(1.2 * SR), dtype=np.float32)
    place(out, thump(90, 0.08, 0.8), 0.0)
    place(out, click(1200, 0.02, 0.5), 0.02)
    return norm(out, 0.5)


def chair():
    out = np.zeros(int(1.4 * SR), dtype=np.float32)
    place(out, creak(0.7, 230) * 0.6, 0.0)
    place(out, lp_fast(noise(0.6) * env(int(0.6 * SR), 0.05, 0.2), 900) * 0.4, 0.3)  # cushion
    return norm(out, 0.35)


def cloth(sec=1.2):
    n = int(sec * SR)
    x = bp_fast(noise(sec), 300, 4000)
    am = lp_fast(np.abs(noise(sec)), 4) * 3
    return norm(x * am * np.sin(np.linspace(0, np.pi, n)), 0.3)


def kneel():
    out = cloth(1.4)
    place(out, thump(75, 0.06, 0.5), 0.7)
    return norm(out, 0.35)


def notebook_close():
    out = np.zeros(int(0.9 * SR), dtype=np.float32)
    place(out, paper_rustle(0.3) * 0.6, 0.0)
    place(out, thump(160, 0.03, 0.6) + bp_fast(noise(0.6) * env(int(0.6 * SR), 0.0005, 0.01), 500, 4000)[: int(0.6 * SR)] * 0.5, 0.25)
    return norm(out, 0.5)


def zip_bag():
    k = t(0.9)
    teeth = ((k * (60 + 40 * k)) % 1 < 0.15).astype(np.float32)
    x = bp_fast(teeth * noise(0.9), 1500, 8000)
    return norm(x * np.sin(np.linspace(0, np.pi, len(k))) ** 0.5, 0.3)


def gurgle():
    sec = 2.5
    out = np.zeros(int(sec * SR), dtype=np.float32)
    at = 0.0
    while at < 1.9:
        d = rng.uniform(0.04, 0.12)
        k = t(d)
        f0 = rng.uniform(250, 600)
        f = f0 * (1 + 2.5 * k / d)
        b = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-k / (d * 0.5)) * rng.uniform(0.3, 1)
        place(out, b.astype(np.float32), at)
        at += rng.uniform(0.04, 0.2)
    glug = lp_fast(noise(sec) * env(len(out), 0.05, 0.5), 300) * 0.5
    return norm(out + glug, 0.5)


# ---------- beds (loops) ----------

def room_tone(sec, hum=0.0, lo=180):
    x = lp_fast(noise(sec), lo) * 0.9 + bp_fast(noise(sec), 200, 2000) * 0.05
    if hum:
        k = t(sec)
        x += hum * (np.sin(2 * np.pi * 50 * k) + 0.4 * np.sin(2 * np.pi * 100 * k))
    return x


def bed_waiting_room():
    sec = 40.0  # the water cooler "gurgles every forty seconds"
    x = room_tone(sec, 0.0, 160)
    x += bp_fast(noise(sec), 300, 1200) * 0.03  # distant traffic through glass
    place(x, gurgle() * 0.8, 14.0)
    return norm(loopable(x), 0.25)


def bed_ruths_room():
    sec = 30.0
    x = room_tone(sec, 0.0, 140) * 0.7
    for s in range(30):
        tick = click(2400 if s % 2 else 2000, 0.012, 1.0) + modes(0.06, [1300], [0.02], [0.3])
        place(x, tick * 0.55, s + 0.5)
    return norm(loopable(x, 0.5), 0.3)


def bed_kitchen_night():
    sec = 30.0
    n = int(sec * SR)
    hiss = bp_fast(noise(sec), 2000, 9000) * 0.12 * (0.7 + 0.3 * lp_fast(np.abs(noise(sec)), 0.5) * 3)
    drops = np.zeros(n, dtype=np.float32)
    for _ in range(int(sec * 22)):
        at = rng.uniform(0, sec - 0.1)
        d = click(rng.uniform(1500, 5000), rng.uniform(0.002, 0.008), rng.uniform(0.1, 0.5))
        place(drops, d, at)
    fridge = room_tone(sec, 0.006, 120) * 0.6
    x = hiss + drops * 0.5 + fridge
    return norm(loopable(x), 0.3)


def bed_corridor():
    sec = 30.0
    k = t(sec)
    buzz = sum(a * np.sin(2 * np.pi * f * k) for f, a in [(100, 1), (200, 0.5), (300, 0.3), (400, 0.15), (1200, 0.04)])
    buzz *= 0.04 * (1 + 0.15 * np.sin(2 * np.pi * 0.21 * k))
    fridge = lp_fast(noise(sec), 120) * 0.9 + 0.03 * np.sin(2 * np.pi * 50 * k)
    air = lp_fast(noise(sec), 400) * 0.3
    x = buzz + fridge + air
    # far off: a trolley, a door, a monitor beeping, footsteps going past
    place(x, lp_fast(footsteps(7, 0.5, fade_out=True), 1200) * 0.25, 6.0)
    place(x, lp_fast(door_close(), 900) * 0.2, 17.0)
    for b in range(3):
        place(x, (np.sin(2 * np.pi * 980 * t(0.18)) * env(int(0.18 * SR), 0.005, 0.1)).astype(np.float32) * 0.03, 22.0 + b * 1.1)
    return norm(loopable(x), 0.3)


SOUNDS = {
    "bed_waiting_room": bed_waiting_room, "bed_ruths_room": bed_ruths_room,
    "bed_kitchen_night": bed_kitchen_night, "bed_corridor": bed_corridor,
    "pen_click": pen_click, "pen_taps": pen_taps, "lid_click": lid_click, "page_flip": page_flip,
    "paper_rustle": paper_rustle, "scribble": scribble, "scribble_out": scribble_out, "peel": peel,
    "palm_slap_glass": palm_slap_glass, "fist_bang_glass": fist_bang_glass, "forehead_glass": forehead_glass,
    "coin_clink": coin_clink, "coin_insert": coin_insert, "spiral_motor": spiral_motor,
    "packet_drop": packet_drop, "crisp_open": crisp_open, "crunch": crunch, "stairs": stairs,
    "steps": lambda: norm(footsteps(4, 0.55), 0.5), "steps_soft": lambda: norm(footsteps(3, 0.7, soft=True), 0.35),
    "door_open": door_open, "door_close": door_close, "chair": chair, "kneel": kneel, "cloth": cloth,
    "notebook_close": notebook_close, "zip_bag": zip_bag,
}


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for name, make in SOUNDS.items():
        a = np.clip(make(), -1, 1).astype(np.float32)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                        "-b:a", "96k", os.path.join(out, name + ".mp3")], input=a.tobytes(), check=True)
        print(f"{name}: {len(a) / SR:.1f}s")


if __name__ == "__main__":
    main()
