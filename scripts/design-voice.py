"""Generate English announcer WAVs from a local Kokoro v1.0 model.
Usage: python scripts/design-voice.py path/to/kokoro-v1.0.int8.onnx path/to/voices-v1.0.bin
Requires kokoro-onnx, soundfile and scipy in the authoring environment.
"""
import json
from pathlib import Path
import sys

from kokoro_onnx import Kokoro
import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt
import soundfile as sf

assets = Path(__file__).resolve().parents[1] / 'assets' / 'audio'
lines = json.loads((assets / 'lines.json').read_text(encoding='utf-8'))
tts = Kokoro(*sys.argv[1:3])
for name in ('welcome', 'prompt'):
    samples, rate = tts.create(lines[name], voice='af_nicole', speed=.94, lang='en-us')
    clean = np.pad(np.trim_zeros(samples), (int(.12 * rate), int(.30 * rate)))
    bandpass = butter(2, [190, 5200], btype='bandpass', fs=rate, output='sos')
    dry = .2 * clean + .8 * sosfilt(bandpass, clean)
    impulse = np.zeros(int(.22 * rate))
    impulse[0] = 1
    for delay, gain in [(0.018, .17), (.044, .12), (.082, .10), (.135, .055), (.183, .035)]:
        impulse[int(delay * rate)] = gain
    system = fftconvolve(dry, impulse)[:len(clean)]
    if name == 'welcome':
        cue_length = int(.09 * rate)
        t = np.arange(cue_length) / rate
        system[:cue_length] += .037 * np.sin(2 * np.pi * (760 * t + 2100 * t * t)) * np.hanning(cue_length)
    for style, audio in [('clean', clean), ('system', system)]:
        peak = max(.01, np.max(np.abs(audio)))
        sf.write(assets / f'{name}-{style}.wav', audio * .79 / peak, rate, subtype='PCM_16')
