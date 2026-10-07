"""Pack each recorded voice option into one MP3 for the table-read page.

The page can only publish a few hundred files, and the cast options are
hundreds of short clips. This joins each option's clips into one file with a
gap between them and rewrites the cast index so each clip points at its slice
(s = sprite file, o = offset in seconds). The page cuts the slices back out.

Usage: python3 make_sprites.py AUDIO_DIR DRAFT OUT_DIR
  reads  AUDIO_DIR/<DRAFT>.cast.json and the clips it names
  writes OUT_DIR/<DRAFT>-cast/<OPTION>.mp3 and OUT_DIR/<DRAFT>.cast.json
"""
import json
import os
import subprocess
import sys

import numpy as np

SR = 24000
GAP = 0.25


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def encode(audio, path):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-b:a", "64k", path], input=audio.astype(np.float32).tobytes(), check=True)


def main():
    audio_dir, draft, out = sys.argv[1:4]
    idx = json.load(open(os.path.join(audio_dir, draft + ".cast.json")))
    folder = draft + "-cast"
    os.makedirs(os.path.join(out, folder), exist_ok=True)
    gap = np.zeros(int(GAP * SR), dtype=np.float32)
    for role, options in idx["roles"].items():
        for o in options:
            parts, t = [gap], GAP
            sprite = f"{folder}/{o['id']}.mp3"
            for clips in o["clips"].values():
                for c in clips:
                    a = decode(os.path.join(audio_dir, c["f"]))
                    c["s"], c["o"], c["dur"] = sprite, round(t, 4), round(len(a) / SR, 4)
                    parts += [a, gap]
                    t += len(a) / SR + GAP
            encode(np.concatenate(parts), os.path.join(out, sprite))
            print(role, o["id"], o["label"], f"{t:.0f}s")
    json.dump(idx, open(os.path.join(out, draft + ".cast.json"), "w"))


if __name__ == "__main__":
    main()
