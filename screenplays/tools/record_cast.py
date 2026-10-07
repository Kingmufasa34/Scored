"""Record one casting option for one part of a draft (a GitHub Actions matrix job).

Each part (ALICE, DANIEL, RUTH, DIRECTOR) gets several voice options from real
British and Irish speakers. Each job records one option, using standard
Chatterbox (it honours the expressiveness settings, unlike Turbo) and keeping
the better of two takes by speech recognition. The table-read page lets you pick
an option per part.

Usage:
  python3 record_cast.py DRAFT OUT_DIR ROLE OPTION [--performance PERF.json]
Writes OUT_DIR/<ROLE>-<OPTION>/eNNN-K.mp3 and OUT_DIR/<ROLE>-<OPTION>.json
"""
import argparse
import io
import json
import os
import sys

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import table_read_audio as T  # noqa: E402

SR = T.SR

# Where each part's voices come from: (accent words, gender) per option, best first.
CASTING = {
    "ALICE": [("irish", "female"), ("irish", "female"), ("irish", "female")],
    "DANIEL": [("southern", "male"), ("southern", "male"), ("southern", "male")],
    "RUTH": [("scottish", "female"), ("northern", "female"), ("welsh", "female")],
    "DIRECTOR": [("southern", "male"), ("midlands", "male"), ("scottish", "male")],
}
# Livelier than before; lower cfg slows and loosens the delivery.
DELIVERY = {"ALICE": (0.7, 0.3), "DANIEL": (0.75, 0.3), "RUTH": (0.55, 0.35), "DIRECTOR": (0.4, 0.45)}
# Known VCTK speakers (Irish English) for parts the dialect corpus lacks.
VCTK_IRISH_F = ["p340", "p288", "p295", "p266", "p283"]


def log(*a):
    print(*a, flush=True)


def to_mono(b):
    a, sr = sf.read(io.BytesIO(b), dtype="float32")
    if a.ndim > 1:
        a = a.mean(axis=1)
    if sr != SR:
        import librosa
        a = librosa.resample(a, orig_sr=sr, target_sr=SR)
    return T.trim(a)


def build_ref(clips):
    parts, total = [], 0.0
    for a in clips:
        parts += [a, np.zeros(int(0.3 * SR), dtype=np.float32)]
        total += len(a) / SR
        if total >= 11:
            break
    ref = np.concatenate(parts)
    return ref / (np.max(np.abs(ref)) or 1) * 0.9


def from_dialects(accent, gender, nth):
    """ylacombe/english_dialects: Google's British Isles accents corpus (CC BY-SA 4.0)."""
    from datasets import Audio, get_dataset_config_names, load_dataset
    repo = "ylacombe/english_dialects"
    names = get_dataset_config_names(repo)
    cfg = next((n for n in names if accent in n and n.endswith("_" + gender)), None)
    if not cfg:
        raise RuntimeError(f"no {accent} {gender} config in {names}")
    ds = load_dataset(repo, cfg, split="train", streaming=True).cast_column("audio", Audio(decode=False))
    by_spk = {}
    for n, row in enumerate(ds):
        spk = str(row.get("speaker_id"))
        lst = by_spk.setdefault(spk, [])
        if len(lst) < 5:
            a = to_mono(row["audio"]["bytes"])
            if 2 < len(a) / SR < 12:
                lst.append(a)
        full = [s for s, v in by_spk.items() if len(v) >= 4]
        if len(full) > nth or n > 4000:
            break
    full = sorted(s for s, v in by_spk.items() if len(v) >= 3)
    if not full:
        raise RuntimeError(f"no speakers with enough audio in {cfg}")
    spk = full[nth % len(full)]
    return build_ref(by_spk[spk]), {"corpus": f"{repo} [{cfg}] (CC BY-SA 4.0)", "speaker": spk}


def from_vctk(speaker):
    """VCTK (CC BY 4.0): find a parquet copy on the hub and read just one speaker's rows."""
    import pyarrow.parquet as pq
    from huggingface_hub import HfFileSystem, list_datasets
    fs = HfFileSystem()
    repos = [d.id for d in list_datasets(search="vctk", limit=30)]
    log("vctk candidates:", repos)
    for repo in repos:
        try:
            files = [f for f in fs.glob(f"datasets/{repo}/**/*.parquet")]
        except Exception:
            continue
        for f in files:
            try:
                pf = pq.ParquetFile(fs.open(f))
                cols = pf.schema_arrow.names
                spk_col = next((c for c in ("speaker_id", "speaker") if c in cols), None)
                if not spk_col or "audio" not in cols:
                    break
                for g in range(pf.num_row_groups):
                    ids = pf.read_row_group(g, columns=[spk_col]).column(0).to_pylist()
                    if speaker not in [str(x) for x in ids]:
                        continue
                    tbl = pf.read_row_group(g, columns=[spk_col, "audio"]).to_pylist()
                    clips = [to_mono(r["audio"]["bytes"]) for r in tbl if str(r[spk_col]) == speaker][:5]
                    clips = [c for c in clips if 2 < len(c) / SR < 12]
                    if len(clips) >= 3:
                        return build_ref(clips), {"corpus": f"VCTK via {repo} (CC BY 4.0)", "speaker": speaker}
            except Exception as e:
                log(f"  {f}: {e!r}"[:200])
    raise RuntimeError(f"VCTK speaker {speaker} not found")


def reference(role, option):
    accent, gender = CASTING[role][option]
    if accent == "irish" and gender == "female":
        try:
            return from_vctk(VCTK_IRISH_F[option])
        except Exception as e:
            log("VCTK Irish voice unavailable:", repr(e)[:300])
            try:
                return from_dialects("irish", "female", option)
            except Exception as e2:
                log("no Irish women in the dialect corpus either, using a Welsh one:", repr(e2)[:200])
                return from_dialects("welsh", "female", option)
    return from_dialects(accent, gender, option)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("draft")
    ap.add_argument("out")
    ap.add_argument("role")
    ap.add_argument("option", type=int)
    ap.add_argument("--performance")
    a = ap.parse_args()
    import voice_test as VT
    els = T.parse(open(a.draft, encoding="utf-8").read())
    perf = json.load(open(a.performance)) if a.performance and os.path.exists(a.performance) else {"lines": {}}
    oid = f"{a.role}-{a.option + 1}"
    folder = os.path.join(a.out, oid)
    os.makedirs(folder, exist_ok=True)

    ref, credit = reference(a.role, a.option)
    ref_path = os.path.join(folder, "reference.wav")
    sf.write(ref_path, ref, SR)
    accent = CASTING[a.role][a.option][0]
    label = f"{accent.capitalize()} {'woman' if CASTING[a.role][a.option][1] == 'female' else 'man'} {a.option + 1}"
    if "Welsh" in credit.get("corpus", "") or ("welsh" in credit.get("corpus", "") and accent == "irish"):
        label = f"Welsh woman {a.option + 1}"
    log(oid, label, credit)

    from chatterbox.tts import ChatterboxTTS
    import librosa
    import torch
    torch.set_num_threads(os.cpu_count() or 4)
    model = ChatterboxTTS.from_pretrained(device="cpu")
    judge = VT.Judge()
    base_ex, base_cfg = DELIVERY[a.role]

    def say(text, ex, cfg, takes=2):
        best, best_s = None, -1
        for _ in range(takes):
            wav = model.generate(VT.TAG_RE.sub("", text).strip(), audio_prompt_path=ref_path, exaggeration=ex, cfg_weight=cfg)
            clip = T.trim(wav.squeeze().cpu().numpy().astype(np.float32))
            s = judge.score(librosa.resample(clip, orig_sr=SR, target_sr=16000), text)  # Whisper hears 16 kHz
            if s > best_s:
                best, best_s = clip, s
            if s >= 0.95:
                break
        return best, best_s

    clips = {}
    for i, e in enumerate(els):
        out = []
        if a.role == "DIRECTOR" and e["t"] in ("scene", "trans", "center", "action"):
            text = T.narration(e)
            pieces = []
            for chunk in T.chunks(text):
                c, _ = say(chunk, base_ex, base_cfg, takes=1)
                pieces += [c, np.zeros(int(0.25 * SR), dtype=np.float32)]
            audio = T.fade(np.concatenate(pieces[:-1]))
            out.append(("narr", audio, False, False))
        elif e["t"] == "dlg" and (e["who"] == a.role or a.role == "DIRECTOR"):
            notes = perf["lines"].get(str(i), [])
            par, n = None, 0
            for ln in e["lines"]:
                if "par" in ln:
                    par = ln["par"]
                    if a.role == "DIRECTOR":
                        c, _ = say(T._decap(par.strip("()")).capitalize() + ".", base_ex, base_cfg, takes=1)
                        out.append(("par", T.fade(c), False, False))
                    continue
                if a.role == "DIRECTOR":
                    continue
                text, cut, trail = T.clean(ln["text"])
                note = notes[n] if n < len(notes) and notes[n].get("text") == ln["text"] else {}
                n += 1
                ex, cfg, gain = T.delivery({"exaggeration": note.get("exaggeration", base_ex), "cfg_weight": note.get("cfg", base_cfg)}, par)
                c, s = say(note.get("say", text), ex, cfg)
                log(f"[{i}] {e['who']} {s:.2f}: {text[:50]}")
                c = c * gain
                if cut:
                    c = c[: max(int(len(c) * 0.9), len(c) - int(0.18 * SR))]
                out.append(("line", T.fade(c, ms_out=25 if cut else 60), cut, trail))
        if out:
            clips[str(i)] = []
            for k, (kind, audio, cut, trail) in enumerate(out):
                name = f"e{i:03d}-{k}.mp3"
                T.write_mp3(audio, os.path.join(folder, name), bitrate="64k")
                clips[str(i)].append({"f": f"{oid}/{name}", "kind": kind, "dur": round(len(audio) / SR, 3), "cut": cut, "trail": trail})
    os.remove(ref_path)
    json.dump({"id": oid, "role": a.role, "label": label, "credit": credit, "clips": clips},
              open(os.path.join(a.out, oid + ".json"), "w"), indent=0)
    log("done", oid, len(clips), "elements")


if __name__ == "__main__":
    sys.exit(main())
