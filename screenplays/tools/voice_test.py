"""A/B voice test for one scene: the current recording vs. a performance-directed one.

B uses:
  - real human reference voices (the Expresso research corpus: real people
    reading in different styles), picked by pitch for each character's gender
  - Chatterbox Turbo, which understands [laugh], [sigh], [sniff]... (falls back
    to standard Chatterbox with the tags removed if Turbo can't load)
  - the draft's performance sheet (mood, exaggeration, pacing per line)
  - several takes per line, the best chosen by speech recognition (the take
    whose words come out closest to the script; garbled takes lose)

A is assembled from the existing table-read clips with the same timing rules.

Usage:
  python3 voice_test.py DRAFT.fountain CLIPS_DIR PERFORMANCE.json OUT_DIR \
      --scene "HOSPITAL CORRIDOR" --fallback-refs VOICES_DIR [--takes 3]
"""
import argparse
import io
import json
import os
import re
import subprocess
import sys

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import table_read_audio as T  # noqa: E402

SR = T.SR
TAG_RE = re.compile(r"\[[a-z ]+\]")

# Which kind of real voice each part gets, and which recorded styles suit them.
WANT = {
    "ALICE": ("female", ["default", "happy", "confused"]),
    "RUTH": ("female", ["default", "enunciated", "narration"]),
    "DANIEL": ("male", ["sad", "default", "confused"]),
    "DIRECTOR": ("male", ["narration", "default", "enunciated"]),
}


def log(*a):
    print(*a, flush=True)


def decode(b):
    """Decode audio bytes (any format ffmpeg reads) to mono float32 at SR."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", "pipe:0", "-f", "wav", "-ac", "1", "-ar", str(SR), "pipe:1"],
                         input=b, capture_output=True, check=True).stdout
    a, _ = sf.read(io.BytesIO(raw), dtype="float32")
    return a


def median_f0(a):
    import librosa
    f0, _, _ = librosa.pyin(a[: SR * 6], fmin=60, fmax=400, sr=SR)
    f0 = f0[~np.isnan(f0)]
    return float(np.median(f0)) if len(f0) else 0.0


# ---------- Human reference voices ----------

def open_expresso(tried):
    """Find a loadable copy of the Expresso corpus on the Hugging Face hub."""
    from datasets import Audio, load_dataset
    names = ["ylacombe/expresso"]
    try:
        from huggingface_hub import list_datasets
        names += [d.id for d in list_datasets(search="expresso", limit=20) if d.id not in names]
    except Exception as e:
        tried.append(f"hub search failed: {e!r}"[:300])
    log("expresso candidates:", names)
    for name in names:
        try:
            ds = load_dataset(name, split="train", streaming=True)
            first = next(iter(ds.cast_column("audio", Audio(decode=False))))
            cols = list(first.keys())
            spk = next((k for k in ("speaker_id", "speaker", "spk_id") if k in cols), None)
            sty = next((k for k in ("style", "emotion", "expression") if k in cols), None)
            log(f"  {name}: columns {cols}")
            if spk and sty and "audio" in cols:
                return ds.cast_column("audio", Audio(decode=False)), spk, sty, name
            tried.append(f"{name}: columns {cols}")
        except Exception as e:
            tried.append(f"{name}: {e!r}"[:300])
            log(f"  {name}: {e!r}"[:300])
    raise RuntimeError("no usable Expresso copy; tried: " + " | ".join(tried))


def fetch_human_refs(outdir, max_rows=6000):
    """Pull real-speaker reference clips from the Expresso corpus (CC BY-NC 4.0)."""
    tried = []
    ds, spk_key, sty_key, name = open_expresso(tried)
    pool = {}  # (speaker, style) -> list of audio arrays
    for n, row in enumerate(ds):
        if n >= max_rows:
            break
        key = (str(row[spk_key]), str(row[sty_key]))
        if len(pool.get(key, [])) >= 4:
            continue
        try:
            a = decode(row["audio"]["bytes"])
        except Exception:
            continue
        if 1.5 < len(a) / SR < 12:
            pool.setdefault(key, []).append(T.trim(a))
    speakers = sorted({s for s, _ in pool})
    log("speakers found:", speakers, "styles:", sorted({st for _, st in pool}))
    # Rank speakers by typical pitch, measured over a few clips each (expressive
    # styles can run high), and call the lower half male. A fixed cut-off failed
    # on this corpus.
    pitch = {}
    for spk in speakers:
        clips = [a for (sp, st), v in pool.items() if sp == spk and st in ("default", "narration", "enunciated", "sad") for a in v[:2]]
        clips = clips or [a for (sp, _), v in pool.items() if sp == spk for a in v[:2]]
        f0s = [median_f0(a) for a in clips[:4]]
        f0s = [f for f in f0s if f > 0]
        pitch[spk] = float(np.median(f0s)) if f0s else 0.0
    ranked = sorted(speakers, key=lambda x: pitch[x])
    half = max(1, len(ranked) // 2)
    gender = {spk: ("male" if k < half else "female") for k, spk in enumerate(ranked)}
    for spk in ranked:
        log(f"  {spk}: median pitch {pitch[spk]:.0f} Hz -> {gender[spk]}")
    os.makedirs(outdir, exist_ok=True)
    used, credits = set(), {}
    for role, (g, styles) in WANT.items():
        cands = [s for s in speakers if gender[s] == g]
        fresh = [s for s in cands if s not in used] or cands
        choice = None
        for st in styles:
            for s in fresh:
                if (s, st) in pool:
                    choice = (s, st)
                    break
            if choice:
                break
        if not choice:
            raise RuntimeError(f"no {g} voice for {role}")
        used.add(choice[0])
        clips, total = [], 0.0
        for a in pool[choice]:
            clips += [a, np.zeros(int(0.3 * SR), dtype=np.float32)]
            total += len(a) / SR
            if total >= 10:
                break
        ref = np.concatenate(clips)
        ref = ref / (np.max(np.abs(ref)) or 1) * 0.9
        sf.write(os.path.join(outdir, role.lower() + ".wav"), ref, SR)
        credits[role] = {"corpus": f"Expresso (CC BY-NC 4.0) via {name}", "speaker": choice[0], "style": choice[1],
                         "pitch_hz": round(pitch[choice[0]]),
                         "seconds": round(len(ref) / SR, 1)}
        log(f"{role}: speaker {choice[0]}, style {choice[1]}, {len(ref) / SR:.1f}s")
    return credits


# ---------- Voice model ----------

class Model:
    def __init__(self):
        import torch
        torch.set_num_threads(os.cpu_count() or 4)
        try:
            from chatterbox.tts_turbo import ChatterboxTurboTTS
            self.m = ChatterboxTurboTTS.from_pretrained(device="cpu")
            self.kind = "turbo"
        except Exception as e:
            log("Chatterbox Turbo unavailable, using standard Chatterbox:", repr(e)[:300])
            from chatterbox.tts import ChatterboxTTS
            self.m = ChatterboxTTS.from_pretrained(device="cpu")
            self.kind = "standard"
        log("voice model:", self.kind)

    def say(self, text, ref, ex, cfg):
        if self.kind != "turbo":
            text = TAG_RE.sub("", text).strip()
        try:
            wav = self.m.generate(text, audio_prompt_path=ref, exaggeration=ex, cfg_weight=cfg)
        except TypeError:
            wav = self.m.generate(text, audio_prompt_path=ref)
        a = wav.squeeze().cpu().numpy().astype(np.float32)
        if self.m.sr != SR:
            import librosa
            a = librosa.resample(a, orig_sr=self.m.sr, target_sr=SR)
        return T.trim(a)


class Judge:
    """Scores a take by how closely speech recognition hears the script's words."""
    def __init__(self):
        import whisper
        self.m = whisper.load_model("base.en", device="cpu")

    @staticmethod
    def words(s):
        return re.sub(r"[^a-z' ]", " ", TAG_RE.sub("", s).lower()).split()

    def score(self, a, text):
        want = self.words(text)
        if not want:
            return 1.0
        heard = self.m.transcribe(a, language="en", fp16=False)["text"]
        self.last_heard = heard.strip()
        got = self.words(heard)
        # word error rate via edit distance
        d = list(range(len(got) + 1))
        for i, w in enumerate(want, 1):
            prev, d[0] = d[0], i
            for j, g in enumerate(got, 1):
                prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (w != g))
        return max(0.0, 1 - d[len(got)] / len(want))


def best_take(model, judge, text, ref, ex, cfg, takes, check_text, heard=None):
    results = []
    for k in range(takes):
        a = model.say(text, ref, ex, cfg)
        s = judge.score(a, check_text) if check_text else 1.0
        results.append((s, a))
        h = getattr(judge, "last_heard", "")
        if heard is not None:
            heard.append({"say": text, "heard": h, "match": round(s, 2), "seconds": round(len(a) / SR, 1)})
        log(f"    take {k + 1}: {s:.2f} match, {len(a) / SR:.1f}s, heard: {h!r}")
    # every take garbled? try again without the sound tags, which can derail short lines
    if max(s for s, _ in results) < 0.5 and TAG_RE.search(text):
        plain = TAG_RE.sub("", text).strip()
        log("    all takes failed; retrying without sound tags:", plain)
        for k in range(takes):
            a = model.say(plain, ref, ex, cfg)
            s = judge.score(a, check_text) if check_text else 1.0
            results.append((s, a))
            h = getattr(judge, "last_heard", "")
            if heard is not None:
                heard.append({"say": plain, "heard": h, "match": round(s, 2), "seconds": round(len(a) / SR, 1)})
            log(f"    retry {k + 1}: {s:.2f} match, {len(a) / SR:.1f}s, heard: {h!r}")
    top = max(s for s, _ in results)
    good = [(s, a) for s, a in results if s >= top - 0.05]
    durs = sorted(len(a) for _, a in good)
    mid = durs[len(durs) // 2]
    s, a = min(good, key=lambda x: abs(len(x[1]) - mid))  # the typical one, not the rushed or dragged one
    return a, s, [round(x, 2) for x, _ in results]


# ---------- Scene assembly (same timing rules as the table read) ----------

def scene_range(els, name):
    start = next(i for i, e in enumerate(els) if e["t"] == "scene" and name.upper() in e["text"].upper())
    end = next((i for i in range(start + 1, len(els)) if els[i]["t"] in ("scene", "trans")), len(els))
    return start, end


def mix(items):
    """items: list of (start_seconds, audio)."""
    length = max(int((s + len(a) / SR) * SR) for s, a in items) + SR
    track = np.zeros(length, dtype=np.float32)
    for s, a in items:
        i = int(s * SR)
        track[i:i + len(a)] += a
    return track / (np.max(np.abs(track)) or 1) * 0.89


def lay_out(els, rng, clip_for, sounds_for=lambda i: []):
    """clip_for(i, e) -> list of (kind, audio, cut, trail) for element i."""
    items, t, prev_end, last_dlg = [], 0.5, 0.0, 0.0
    for i in range(*rng):
        e = els[i]
        clips = clip_for(i, e)
        if e["t"] == "dlg":
            start = max(last_dlg + 0.3, prev_end - 0.9) if e.get("overlap") else t
            last_dlg, last = start, None
            for kind, a, cut, trail in clips:
                items.append((start, a))
                prev_end = start + len(a) / SR
                start = prev_end + 0.18
                last = (cut, trail)
            t = prev_end - 0.12 if last and last[0] else prev_end + 0.9 if last and last[1] else prev_end + 0.3
        else:
            for kind, a, _, _ in clips:
                items.append((t, a))
                t += len(a) / SR
            end_of_el = t
            for snd in sounds_for(i):
                items.append((end_of_el + snd[0], snd[1]))
                t = max(t, end_of_el + snd[0] + len(snd[1]) / SR)
            t += 0.5 if e["t"] == "scene" else 0.35
    return mix(items)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("draft")
    ap.add_argument("clips_dir", help="folder holding draft-NN.clips.json and its clip folder")
    ap.add_argument("performance")
    ap.add_argument("out")
    ap.add_argument("--scene", default="HOSPITAL CORRIDOR")
    ap.add_argument("--fallback-refs", default="voices")
    ap.add_argument("--takes", type=int, default=3)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    els = T.parse(open(a.draft, encoding="utf-8").read())
    rng = scene_range(els, a.scene)
    perf = json.load(open(a.performance))
    report = {"scene": a.scene, "elements": list(range(*rng))}

    # ---- A: the current recording, from its clips ----
    name = os.path.splitext(os.path.basename(a.draft))[0]
    manifest = {m["i"]: m for m in json.load(open(os.path.join(a.clips_dir, name + ".clips.json")))["elements"]}

    def current(i, e):
        out = []
        for c in manifest[i]["clips"]:
            if c["kind"] == "par":
                continue
            out.append((c["kind"], decode(open(os.path.join(a.clips_dir, c["f"]), "rb").read()), c.get("cut"), c.get("trail")))
        return out
    T.write_mp3(lay_out(els, rng, current), os.path.join(a.out, "A-current.mp3"))
    log("wrote A-current.mp3")

    # ---- B: human references + Turbo + performance sheet + best takes ----
    refs = os.path.join(a.out, "refs")
    try:
        report["voices"] = fetch_human_refs(refs)
        report["human_voices"] = True
    except Exception as ex:
        log("Couldn't get human reference voices, falling back to the Kokoro ones:", repr(ex)[:800])
        report["human_voices_error"] = repr(ex)[:1500]
        os.makedirs(refs, exist_ok=True)
        for role in WANT:
            src = os.path.join(a.fallback_refs, role.lower() + ".wav")
            if os.path.exists(src):
                subprocess.run(["cp", src, os.path.join(refs, role.lower() + ".wav")], check=True)
        report["human_voices"] = False
    model, judge = Model(), Judge()
    report["model"] = model.kind
    report["lines"] = {}

    def ref_for(who):
        p = os.path.join(refs, who.lower() + ".wav")
        return p if os.path.exists(p) else os.path.join(refs, "director.wav")

    def directed(i, e):
        if e["t"] == "dlg":
            notes = perf["lines"].get(str(i), [])
            out, n = [], 0
            for ln in e["lines"]:
                if "par" in ln:
                    continue
                text, cut, trail = T.clean(ln["text"])
                note = notes[n] if n < len(notes) and notes[n].get("text") == ln["text"] else {}
                n += 1
                say = note.get("say", text)
                ex = note.get("exaggeration", 0.5)
                cfg = note.get("cfg", 0.5)
                log(f"[{i}] {e['who']} ({note.get('mood', 'no note')}): {say}")
                heard = []
                clip, score, scores = best_take(model, judge, say, ref_for(e["who"]), ex, cfg, a.takes, text, heard)
                if cut:
                    clip = clip[: max(int(len(clip) * 0.9), len(clip) - int(0.18 * SR))]
                report["lines"][str(i)] = {"who": e["who"], "say": say, "takes": heard, "kept": round(score, 2)}
                out.append(("line", T.fade(clip, ms_out=25 if cut else 60), cut, trail))
            return out
        text = T.narration(e)
        if not text:
            return []
        log(f"[{i}] DIRECTOR: {text[:60]}")
        pieces = []
        for chunk in T.chunks(text):
            clip, _, _ = best_take(model, judge, chunk, ref_for("DIRECTOR"), 0.3, 0.5, 2, chunk)
            pieces += [clip, np.zeros(int(0.25 * SR), dtype=np.float32)]
        return [("narr", T.fade(np.concatenate(pieces[:-1])), False, False)]

    def sounds(i):
        out = []
        for s in perf.get("sounds", {}).get(str(i), []):
            if model.kind != "turbo":
                continue  # standard Chatterbox can't do non-verbal sounds
            log(f"[{i}] {s['who']} sound: {s['say']}")
            clip = model.say(s["say"], ref_for(s["who"]), 0.7, 0.4)
            out.append((s.get("after", 0.3), T.fade(clip[: int(4 * SR)])))
        return out
    T.write_mp3(lay_out(els, rng, directed, sounds), os.path.join(a.out, "B-directed.mp3"))
    log("wrote B-directed.mp3")
    json.dump(report, open(os.path.join(a.out, "report.json"), "w"), indent=1)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write(f"### Voice test ready\n\nModel: {model.kind}. Human voices: {report['human_voices']}.\n")


if __name__ == "__main__":
    sys.exit(main())
