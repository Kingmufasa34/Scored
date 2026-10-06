"""Make one short reference clip per character with Kokoro's British voices.

Chatterbox clones each clip's voice, so these set who sounds like whom.
Change a voice here to recast a character.
"""
import os
import sys

import soundfile as sf
from kokoro_onnx import Kokoro

VOICES = {
    "alice.wav": "bf_emma",
    "daniel.wav": "bm_george",
    "ruth.wav": "bf_isabella",
    "extra.wav": "bm_lewis",
}
TEXT = ("I wasn't sure about coming, honestly. But we're here now, aren't we. "
        "I suppose we just start somewhere and see where it goes. "
        "Sorry, I'm rambling. You can stop me if I'm rambling.")

out = sys.argv[1] if len(sys.argv) > 1 else "voices"
os.makedirs(out, exist_ok=True)
k = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
for name, v in VOICES.items():
    samples, sr = k.create(TEXT, voice=v, speed=0.95, lang="en-gb")
    sf.write(os.path.join(out, name), samples, sr)
    print("made", name, v, f"{len(samples) / sr:.1f}s")
