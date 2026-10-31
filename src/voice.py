import json, os, re, subprocess, sys
import numpy as np
from kokoro_onnx import Kokoro
from scipy.signal import lfilter

MODEL, SRC, SITE = sys.argv[1], sys.argv[2], sys.argv[3]
VOICE = os.environ.get("SCHWA_VOICE", "bf_emma")
FORCE = "--force" in sys.argv
SR = 24000
TARGET_DB = -20.0
PEAK_DB = -1.5
WORD_STYLE_ROW = 39
PLOSIVES = "pbtdkɡ"
SYMBOLS = {"e": "ɛ", "æ": "a", "eɪ": "A", "aɪ": "I", "ɔɪ": "Y", "əʊ": "Q", "aʊ": "W", "eə": "ɛː", "r": "ɹ", "g": "ɡ", "dʒ": "ʤ", "tʃ": "ʧ"}
REDUCED = {"the": "ðə", "a": "ə", "an": "ən", "to": "tə", "of": "əv", "and": "ənd", "for": "fə", "at": "ət", "are": "ə", "was": "wəz", "were": "wə", "can": "kən", "you": "ju", "he": "hi", "she": "ʃi", "we": "wi", "his": "hɪz", "her": "hə", "him": "hɪm", "them": "ðəm", "do": "də", "has": "həz", "have": "həv", "from": "frəm", "or": "ə", "as": "əz", "than": "ðən", "but": "bət", "it": "ɪt", "i": "I", "me": "mi", "my": "mI", "is": "ɪz", "on": "ɒn", "in": "ɪn", "this": "ðɪs"}
CONTRACTED = {"i've": "Iv", "we're": "wɪə", "i'd": "Id", "i'll": "Il", "it's": "ɪts", "he's": "hiz", "she's": "ʃiz", "that's": "ðats", "there's": "ðɛːz", "where's": "wɛːz", "what's": "wɒts", "let's": "lˈɛts", "don't": "dˈQnt", "can't": "kˈɑːnt", "won't": "wˈQnt"}
SOUND_SLUGS = {"ɪə": "ia", "eɪ": "ei", "ʊə": "ua", "ɔɪ": "oi", "əʊ": "ou", "eə": "ea", "aɪ": "ai", "aʊ": "au"}

load = lambda name: json.load(open(os.path.join(SRC, name), encoding="utf-8"))
DICT = {}
for line in open(os.path.join(SRC, "..", "data", "dict.txt"), encoding="utf-8"):
    w, v = line.rstrip("\n").split("|")
    DICT[w] = v.split(";")


def phonemes(tr):
    out = ""
    for t in tr.split():
        stress = t[0] if t[0] in "ˈˌ" else ""
        out += stress + SYMBOLS.get(t.lstrip("ˈˌ"), t.lstrip("ˈˌ"))
    return out


def main_tr(w):
    return next((tr for tr in DICT[w] if "ˈ" in tr), DICT[w][0])


def word_ph(w):
    return phonemes(main_tr(w.lower()))


def sentence_ph(text, keep, forced=None):
    def one(m):
        w = m.group(0)
        low = w.lower()
        if low == keep:
            return forced or word_ph(low)
        if low in CONTRACTED:
            return CONTRACTED[low]
        if low in REDUCED:
            return REDUCED[low]
        return word_ph(low)
    return re.sub(r"[A-Za-z][A-Za-z']*", one, text)


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


def clip_release(x):
    hop = SR // 200
    e = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    quiet = e < e.max() * .06
    tail = max(0, len(e) - 70)
    last = np.nonzero(quiet[tail:] == False)[0]
    if not len(last):
        return x
    end = tail + last[-1]
    i = end
    while i >= tail and not (quiet[max(0, i - 3):i].all() and i - 3 >= tail):
        i -= 1
    if i < tail:
        return x
    x = x[:(i + 14) * hop].copy()
    fade = SR // 50
    x[-fade:] *= np.linspace(1, 0, fade)
    return x


def finish(x, plosive_end=False):
    x = np.asarray(x, dtype=np.float64)
    if plosive_end:
        x = clip_release(x)
    hop = SR // 100
    rms = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, max(1, len(x) - hop), hop)])
    on = np.nonzero(rms > rms.max() * .012)[0]
    start, end = max(0, (on[0] - 3) * hop), min(len(x), (on[-1] + 9) * hop)
    x = x[start:end]
    w = k_weight(x)
    frames = np.array([np.mean(w[i:i + hop * 2] ** 2) for i in range(0, max(1, len(w) - hop * 2), hop)])
    level = 10 * np.log10(np.mean(frames[frames > frames.max() * .01]) + 1e-12)
    gain = min(10 ** ((TARGET_DB - level) / 20), 10 ** (PEAK_DB / 20) / max(np.abs(x).max(), 1e-9))
    x = x * gain
    fade = SR // 200
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade * 4:] *= np.linspace(1, 0, fade * 4)
    return x


def save(x, path, plosive_end=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-codec:a", "libmp3lame", "-b:a", "48k", path], input=finish(x, plosive_end).astype(np.float32).tobytes(), check=True)


def main():
    tts = Kokoro(os.path.join(MODEL, "kokoro-v1.0.onnx"), os.path.join(MODEL, "voices-v1.0.bin"))
    style = tts.get_voice_style(VOICE)
    steady = np.repeat(style[WORD_STYLE_ROW:WORD_STYLE_ROW + 1], len(style), axis=0)
    speak = lambda ph, speed: tts.create(ph, voice=steady if ph[-1] not in ".?!" else VOICE, speed=speed, is_phonemes=True)[0]
    audio = os.path.join(SITE, "audio")
    plan = []
    for p in load("phonemes.json"):
        slug = p.get("audio") or SOUND_SLUGS[p["id"]]
        ph = SYMBOLS.get(p["id"], p["id"])
        plan.append((os.path.join(audio, slug + ".mp3"), f"ˈɑː{ph}ɑː" if p["kind"] == "cons" else f"ˈ{ph}", .9 if p["kind"] == "cons" else .8))
    words = set()
    for p in load("phonemes.json"):
        words.update(w.lower() for w in p["ex"] + [p["kw"]] + [s[1] for s in p["sp"]])
    for s in load("pairs.json"):
        for pair in s["pairs"]:
            words.update(pair)
    for s in load("sentences.json"):
        words.update(s["pair"])
    build = open(os.path.join(SRC, "build.py"), encoding="utf-8").read()
    words.update(re.search(r'GAME = """(.*?)"""', build, re.S).group(1).split())
    words.update(s.replace("-", "").lower() for s in load("stress.json"))
    words = sorted(w for w in words if w in DICT)
    slug = lambda w: re.sub(r"[^a-z]", "_", w)
    plan += [(os.path.join(audio, "w", slug(w) + ".mp3"), word_ph(w), .85) for w in words]
    for s in load("sentences.json"):
        for k, w in enumerate(s["pair"]):
            plan.append((os.path.join(audio, "s", f"{s['id']}-{'ab'[k]}.mp3"), sentence_ph(s["t"].replace("___", w), w), .95))
    for s in load("weak.json"):
        plan.append((os.path.join(audio, "s", s["id"] + ".mp3"), sentence_ph(s["t"].replace("___", s["w"]), s["w"], phonemes(s["weak"].replace("ð", "ð"))), .95))
    for i, (path, ph, speed) in enumerate(plan):
        if not FORCE and os.path.exists(path):
            continue
        save(speak(ph, speed), path, ph[-1] in PLOSIVES)
        if i % 100 == 0:
            print(i, len(plan), path, ph, flush=True)
    json.dump(words, open(os.path.join(audio, "words.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print("clips:", len(plan), "words:", len(words))


if __name__ == "__main__":
    main()
