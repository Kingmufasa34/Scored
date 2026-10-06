"""Render a Fountain script as a table-read audio file.

Each character gets a consistent voice: a short reference clip per character
(made with Kokoro's British voices) is cloned by Chatterbox, which does the
expressive delivery. Lines are then mixed on one timeline so the written
imperfections become audible:

  line ends with --   cut off: the clip is clipped short and the next speaker
                      comes in on top of the last syllable
  line ends with ...  trailing off: a longer silence follows
  CHARACTER ^         overlapping: starts before the previous line has finished
  (barely), (quietly) quieter, flatter delivery
  action lines        held as silence; "Nothing.", "A beat" etc. hold longer

Output: <out>.mp3 and <out>.json (start/end time of every script element, so a
player can highlight the line being spoken and seek to any line).

Usage:
  python3 table_read_audio.py SCRIPT.fountain OUT_BASENAME --refs DIR [--fake]

--fake swaps the voice model for tones, to test parsing and mixing offline.
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys

import numpy as np
import soundfile as sf

SR = 24000

# Which reference voice each character gets, and how they are performed by
# default. exaggeration: emotional intensity (0.25 flat .. 1.0 heightened).
# cfg_weight: lower = slower, more deliberate pacing.
CAST = {
    "ALICE": {"ref": "alice.wav", "exaggeration": 0.55, "cfg_weight": 0.45},
    "DANIEL": {"ref": "daniel.wav", "exaggeration": 0.5, "cfg_weight": 0.5},
    "RUTH": {"ref": "ruth.wav", "exaggeration": 0.35, "cfg_weight": 0.4},
}
DEFAULT_ROLE = {"ref": "extra.wav", "exaggeration": 0.5, "cfg_weight": 0.5}

SCENE_RE = re.compile(r"^(INT|EXT|INT\./EXT|I/E|EST)[. ]", re.I)
TRANS_RE = re.compile(r"^(FADE IN:|FADE OUT\.|CUT TO BLACK\.|[A-Z ]+ TO:)$")
SILENCE_RE = re.compile(r"\b(nothing\.|a beat|beat\.|long time|doesn't answer|silence|waits|can't\.|it's out|it lands|nobody moves)", re.I)


def parse(src):
    src = src.replace("\r\n", "\n")
    body = src.split("\n====\n", 1)[1] if "\n====\n" in src else src
    out = []
    for b in re.split(r"\n\s*\n", body.strip()):
        lines = [l.strip() for l in b.split("\n") if l.strip()]
        if not lines:
            continue
        first = lines[0]
        bare = first.rstrip("^ ").strip()
        if first.startswith(">") and first.endswith("<"):
            out.append({"t": "center", "text": first[1:-1].strip()})
        elif SCENE_RE.match(first):
            out.append({"t": "scene", "text": first})
        elif TRANS_RE.match(first):
            out.append({"t": "trans", "text": first})
        elif len(lines) > 1 and bare == bare.upper() and re.search(r"[A-Z]", bare) and not bare.startswith("INSERT"):
            who = re.sub(r"\(.*?\)", "", bare).strip()
            d = {"t": "dlg", "who": who, "overlap": first.endswith("^"), "lines": []}
            for l in lines[1:]:
                d["lines"].append({"par": l} if l.startswith("(") else {"text": l})
            out.append(d)
        else:
            out.append({"t": "action", "text": " ".join(lines)})
    return out


def clean(t):
    cut = bool(re.search(r"--\s*$", t))
    trail = bool(re.search(r"(\.\.\.|…)\s*$", t))
    s = re.sub(r"^\s*--\s*", "", t)
    s = re.sub(r"\s*--\s*$", "", s)
    s = re.sub(r"\s*--\s*", ", ", s)
    s = s.replace('"', "").replace("“", "").replace("”", "")
    s = re.sub(r"\s{2,}", " ", s).strip()
    if cut and not re.search(r"[.!?,]$", s):
        s += ","  # keeps the voice mid-thought instead of landing the sentence
    return s, cut, trail


def delivery(role, par):
    """Adjust delivery from a parenthetical."""
    p = (par or "").lower()
    ex, cfg, gain = role["exaggeration"], role["cfg_weight"], 1.0
    if re.search(r"barely|quiet|whisper|muffled|into her|into his|small", p):
        ex, cfg, gain = max(0.25, ex - 0.2), 0.35, 0.55
    elif re.search(r"shout|roar|loud|up,", p):
        ex, cfg, gain = min(1.0, ex + 0.35), 0.3, 1.0
    elif re.search(r"brisk|bright", p):
        ex = min(1.0, ex + 0.1)
    return ex, cfg, gain


class Voice:
    def __init__(self, refs, fake=False, cache="clips"):
        self.refs, self.fake, self.cache = refs, fake, cache
        os.makedirs(cache, exist_ok=True)
        self.model = None
        if not fake:
            import torch
            from chatterbox.tts import ChatterboxTTS
            torch.set_num_threads(os.cpu_count() or 4)
            self.model = ChatterboxTTS.from_pretrained(device="cpu")

    def say(self, who, text, ex, cfg):
        role = CAST.get(who, DEFAULT_ROLE)
        key = hashlib.sha1(f"{who}|{text}|{ex:.2f}|{cfg:.2f}|{self.fake}".encode()).hexdigest()[:16]
        path = os.path.join(self.cache, key + ".wav")
        if os.path.exists(path):
            a, _ = sf.read(path, dtype="float32")
            return a
        if self.fake:
            f = {"ALICE": 330, "DANIEL": 180, "RUTH": 250}.get(who, 220)
            n = int(SR * (0.25 + 0.055 * len(text)))
            t = np.arange(n) / SR
            a = (0.2 * np.sin(2 * np.pi * f * t)).astype(np.float32)
        else:
            ref = os.path.join(self.refs, role["ref"])
            if not os.path.exists(ref):
                ref = os.path.join(self.refs, DEFAULT_ROLE["ref"])
            wav = self.model.generate(text, audio_prompt_path=ref, exaggeration=ex, cfg_weight=cfg)
            a = wav.squeeze().cpu().numpy().astype(np.float32)
            if self.model.sr != SR:
                import librosa
                a = librosa.resample(a, orig_sr=self.model.sr, target_sr=SR)
            a = trim(a)
        sf.write(path, a, SR)
        return a


def trim(a, thresh=0.01):
    idx = np.where(np.abs(a) > thresh)[0]
    if not len(idx):
        return a
    pad = int(0.04 * SR)
    return a[max(0, idx[0] - pad): min(len(a), idx[-1] + pad)]


def fade(a, ms_in=8, ms_out=60):
    a = a.copy()
    i, o = int(SR * ms_in / 1000), int(SR * ms_out / 1000)
    if len(a) > i + o:
        a[:i] *= np.linspace(0, 1, i)
        a[-o:] *= np.linspace(1, 0, o)
    return a


def render(els, voice, log=print):
    track = np.zeros(SR * 60, dtype=np.float32)
    cues = []
    t = 0.5  # seconds: where the next sound starts
    prev_end = 0.0
    last_dlg_start = 0.0

    def place(a, start):
        nonlocal track
        s = int(start * SR)
        need = s + len(a)
        if need > len(track):
            track = np.concatenate([track, np.zeros(need - len(track) + SR * 30, dtype=np.float32)])
        track[s:need] += a
        return start + len(a) / SR

    total = sum(1 for e in els if e["t"] == "dlg")
    done = 0
    for i, e in enumerate(els):
        if e["t"] == "dlg":
            done += 1
            role = CAST.get(e["who"], DEFAULT_ROLE)
            start = t
            if e["overlap"]:
                start = max(last_dlg_start + 0.3, prev_end - 0.9)  # come in over the last line
            elem_start, par = start, None
            last_cut = last_trail = False
            for ln in e["lines"]:
                if "par" in ln:
                    par = ln["par"]
                    continue
                text, cut, trail = clean(ln["text"])
                if not text:
                    continue
                ex, cfg, gain = delivery(role, par)
                log(f"[{done}/{total}] {e['who']}: {text[:60]}")
                a = voice.say(e["who"], text, ex, cfg) * gain
                if cut:
                    a = a[: max(int(len(a) * 0.9), len(a) - int(0.18 * SR))]  # clipped before the end
                a = fade(a, ms_out=25 if cut else 60)
                end = place(a, start)
                prev_end = end
                start = end + 0.18
                last_cut, last_trail = cut, trail
            last_dlg_start = elem_start
            cues.append({"i": i, "start": round(elem_start, 2), "end": round(prev_end, 2), "who": e["who"]})
            if last_cut:
                t = prev_end - 0.12   # next speaker treads on the last syllable
            elif last_trail:
                t = prev_end + 0.9
            else:
                t = prev_end + 0.3
        elif e["t"] == "action":
            hold = 2.2 if SILENCE_RE.search(e["text"]) else min(0.35 + len(e["text"]) * 0.008, 1.8)
            cues.append({"i": i, "start": round(t, 2), "end": round(t + hold, 2), "who": None})
            t += hold
        elif e["t"] in ("scene", "trans"):
            gap = 1.4 if e["t"] == "trans" and re.search(r"FLASH|BACK TO", e["text"]) else 0.6
            cues.append({"i": i, "start": round(t, 2), "end": round(t + gap, 2), "who": None})
            t += gap
        else:
            cues.append({"i": i, "start": round(t, 2), "end": round(t + 1.0, 2), "who": None})
            t += 1.0
    end = int((max(t, prev_end) + 1.0) * SR)
    track = track[:end]
    peak = float(np.max(np.abs(track))) or 1.0
    track = (track / peak * 0.89).astype(np.float32)
    return track, cues


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("out")
    ap.add_argument("--refs", default="voices")
    ap.add_argument("--cache", default="clips")
    ap.add_argument("--fake", action="store_true")
    a = ap.parse_args()
    els = parse(open(a.script, encoding="utf-8").read())
    voice = Voice(a.refs, fake=a.fake, cache=a.cache)
    track, cues = render(els, voice, log=lambda m: print(m, flush=True))
    wav = a.out + ".wav"
    sf.write(wav, track, SR)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-ac", "1", "-b:a", "96k", a.out + ".mp3"], check=True)
    os.remove(wav)
    json.dump({"duration": round(len(track) / SR, 2), "cues": cues}, open(a.out + ".json", "w"), indent=0)
    print(f"wrote {a.out}.mp3 ({len(track) / SR:.1f}s) and {a.out}.json", flush=True)


if __name__ == "__main__":
    sys.exit(main())
