import os, subprocess, sys
import numpy as np
from scipy.signal import lfilter

AUDIO = sys.argv[1]
SR = 44100
TARGET_DB = -20.0
TOLERANCE_DB = .25


def k_weight(x):
    f0, g, q = 1681.97, 3.99984, .7071752
    k, vh, vb = np.tan(np.pi * f0 / SR), 10 ** (g / 20), 10 ** (g / 20 * .4996667)
    a0 = 1 + k / q + k * k
    b = [(vh + vb * k / q + k * k) / a0, 2 * (k * k - vh) / a0, (vh - vb * k / q + k * k) / a0]
    a = [1, 2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0]
    y = lfilter(b, a, x)
    f1, q1 = 38.13, .5003
    k = np.tan(np.pi * f1 / SR)
    a0 = 1 + k / q1 + k * k
    return lfilter([1, -2, 1], [1, 2 * (k * k - 1) / a0, (1 - k / q1 + k * k) / a0], y)


def active_level(x):
    w, hop = k_weight(x), SR // 100
    frames = np.array([np.mean(w[i:i + hop * 2] ** 2) for i in range(0, max(1, len(w) - hop * 2), hop)])
    return 10 * np.log10(np.mean(frames[frames > frames.max() * .01]) + 1e-12)


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


for name in sorted(os.listdir(AUDIO)):
    if not name.endswith(".mp3"):
        continue
    path = os.path.join(AUDIO, name)
    before = active_level(decode(path))
    gain = TARGET_DB - before
    if abs(gain) > TOLERANCE_DB:
        tmp = path + ".tmp.mp3"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-af", f"volume={gain:.2f}dB,alimiter=limit=0.84:level=false", "-codec:a", "libmp3lame", "-b:a", "64k", tmp], check=True)
        os.replace(tmp, path)
    x = decode(path)
    print(f"{name:12} {before:7.2f} -> {active_level(x):7.2f}  peak {20 * np.log10(np.abs(x).max()):6.2f}  {len(x) / SR:.2f}s")
