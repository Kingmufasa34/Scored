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
import shutil
import subprocess
import sys
import time

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
# The director reads scene headings, action, transitions and parentheticals:
# steady and unshowy, so it sits apart from the performances.
DIRECTOR = {"ref": "director.wav", "exaggeration": 0.3, "cfg_weight": 0.5}

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
        role = DIRECTOR if who == "DIRECTOR" else CAST.get(who, DEFAULT_ROLE)
        key = hashlib.sha1(f"{who}|{text}|{ex:.2f}|{cfg:.2f}|{self.fake}".encode()).hexdigest()[:16]
        path = os.path.join(self.cache, key + ".wav")
        if os.path.exists(path):
            a, _ = sf.read(path, dtype="float32")
            return a
        if self.fake:
            f = {"ALICE": 330, "DANIEL": 180, "RUTH": 250, "DIRECTOR": 140}.get(who, 220)
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


def progress(done, total, chars_done, total_chars, began):
    """A text progress bar with a time-left estimate, readable in GitHub's live log."""
    frac = chars_done / total_chars
    width = 24
    filled = int(round(frac * width))
    bar = "█" * filled + "░" * (width - filled)
    elapsed = time.time() - began
    if frac > 0.02 and elapsed > 5:
        left = elapsed / frac - elapsed
        eta = f"~{int(left // 60)}m {int(left % 60):02d}s left"
    else:
        eta = "working out time left..."
    return f"[{bar}] {int(frac * 100):3d}%  line {done}/{total}  {eta}"


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
    total_chars = sum(len(l.get("text", "")) for e in els if e["t"] == "dlg" for l in e["lines"]) or 1
    chars_done = 0
    began = time.time()
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
                a = voice.say(e["who"], text, ex, cfg) * gain
                chars_done += len(ln["text"])
                log(progress(done, total, chars_done, total_chars, began) + f"  {e['who']}: {text[:50]}")
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


# ---------- Director's narration ----------

DECADES = {"20s": "twenties", "30s": "thirties", "40s": "forties", "50s": "fifties",
           "60s": "sixties", "70s": "seventies", "80s": "eighties", "90s": "nineties"}


def _decap(text):
    """Screenplay capitals (ALICE, LIFE AFTER ALICE) read as names, not acronyms; 40s as forties."""
    text = re.sub(r"\b[A-Z][A-Z'’]+\b", lambda m: m.group(0).capitalize(), text)
    return re.sub(r"\b([2-9]0s)\b", lambda m: DECADES[m.group(1)], text)


def narration(e):
    t = e["t"]
    if t == "scene":
        parts = [p.strip() for p in re.split(r"\s+-\s+", e["text"]) if p.strip()]
        head = parts[0]
        head = re.sub(r"^INT\.?/EXT\.?\s*", "Interior, exterior. ", head)
        head = re.sub(r"^INT\.?\s*", "Interior. ", head)
        head = re.sub(r"^EXT\.?\s*", "Exterior. ", head)
        out = [head] + parts[1:]
        out = [re.sub(r"\((.*?)\)", r". \1", x) for x in out]
        return re.sub(r"\s+\.", ".", _decap(". ".join(o.strip().rstrip(".") for o in out))) + "."
    if t == "trans":
        return _decap(e["text"].rstrip(":.")).capitalize() + "."
    if t == "center":
        return "Title card. " + _decap(e["text"]) + "."
    if t == "action":
        s = re.sub(r"^INSERT\s*-\s*", "Insert. ", e["text"])
        s = re.sub(r"\s*--\s*", ", ", s)
        return _decap(s)
    return ""


def chunks(text, limit=220):
    """Long action paragraphs are voiced in sentence groups the model handles well."""
    sents = re.split(r"(?<=[.!?])\s+", text)
    out, cur = [], ""
    for x in sents:
        if cur and len(cur) + len(x) + 1 > limit:
            out.append(cur)
            cur = x
        else:
            cur = (cur + " " + x).strip()
    if cur:
        out.append(cur)
    return out


def export_clips(els, voice, base, log=print):
    """Every element as its own clip, so a player can choose what is read aloud.

    Writes <base>/eNNN-K.mp3 and <base>.clips.json. Dialogue clips are stored as
    performed (gain, cut-offs already applied); the player schedules them.
    """
    folder = base
    os.makedirs(folder, exist_ok=True)
    rel = os.path.basename(base)
    units = []
    for i, e in enumerate(els):
        if e["t"] in ("scene", "trans", "center", "action"):
            units.append(len(narration(e)))
        elif e["t"] == "dlg":
            units += [len(l.get("text") or l.get("par", "")) for l in e["lines"]]
    total_chars, chars_done, began = sum(units) or 1, 0, time.time()
    manifest = []
    n_items = len(units)
    item = 0
    for i, e in enumerate(els):
        entry = {"i": i, "t": e["t"], "who": e.get("who"), "overlap": bool(e.get("overlap")), "clips": []}

        def save(a, k, kind, **extra):
            name = f"e{i:03d}-{k}.mp3"
            write_mp3(a, os.path.join(folder, name), bitrate="64k")
            entry["clips"].append(dict(f=f"{rel}/{name}", kind=kind, dur=round(len(a) / SR, 3), **extra))

        if e["t"] in ("scene", "trans", "center", "action"):
            text = narration(e)
            pieces = [voice.say("DIRECTOR", c, DIRECTOR["exaggeration"], DIRECTOR["cfg_weight"]) for c in chunks(text)]
            gap = np.zeros(int(0.25 * SR), dtype=np.float32)
            a = np.concatenate([x for p in pieces for x in (p, gap)][:-1]) if pieces else gap
            save(fade(a), 0, "narr")
            item += 1
            chars_done += len(text)
            log(progress(item, n_items, chars_done, total_chars, began) + f"  DIRECTOR: {text[:50]}")
        elif e["t"] == "dlg":
            role = CAST.get(e["who"], DEFAULT_ROLE)
            par, k = None, 0
            for ln in e["lines"]:
                item += 1
                if "par" in ln:
                    par = ln["par"]
                    ptxt = _decap(par.strip("()")).capitalize() + "."
                    a = voice.say("DIRECTOR", ptxt, DIRECTOR["exaggeration"], DIRECTOR["cfg_weight"])
                    save(fade(a), k, "par")
                    k += 1
                    chars_done += len(par)
                    log(progress(item, n_items, chars_done, total_chars, began) + f"  DIRECTOR: {ptxt[:50]}")
                    continue
                text, cut, trail = clean(ln["text"])
                if not text:
                    continue
                ex, cfg, gain = delivery(role, par)
                a = voice.say(e["who"], text, ex, cfg) * gain
                if cut:
                    a = a[: max(int(len(a) * 0.9), len(a) - int(0.18 * SR))]
                save(fade(a, ms_out=25 if cut else 60), k, "line", cut=cut, trail=trail)
                k += 1
                chars_done += len(ln["text"])
                log(progress(item, n_items, chars_done, total_chars, began) + f"  {e['who']}: {text[:50]}")
        manifest.append(entry)
    with open(base + ".clips.json", "w") as f:
        json.dump({"version": 1, "elements": manifest}, f, indent=0)
    return manifest


def write_mp3(track, path, bitrate="96k"):
    """MP3 via ffmpeg when present, otherwise libsndfile's own MP3 encoder."""
    if shutil.which("ffmpeg"):
        wav = path[:-4] + ".tmp.wav"
        sf.write(wav, track, SR)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-ac", "1", "-b:a", bitrate, path], check=True)
        os.remove(wav)
    else:
        sf.write(path, track, SR, format="MP3")


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
    log = lambda m: print(m, flush=True)
    clips = export_clips(els, voice, a.out, log=log)
    print(f"wrote {sum(len(c['clips']) for c in clips)} clips and {a.out}.clips.json", flush=True)
    track, cues = render(els, voice, log=lambda m: None)  # all lines cached by now
    json.dump({"duration": round(len(track) / SR, 2), "cues": cues}, open(a.out + ".json", "w"), indent=0)
    write_mp3(track, a.out + ".mp3")
    print(f"wrote {a.out}.mp3 ({len(track) / SR:.1f}s) and {a.out}.json", flush=True)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write(f"### Table read ready\n\n`{os.path.basename(a.out)}.mp3`: {len(track) / SR / 60:.1f} minutes, "
                    f"{sum(1 for c in cues if c['who'])} lines.\n")


if __name__ == "__main__":
    sys.exit(main())
