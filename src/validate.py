import json, re, sys
W = sys.argv[1]
D = {}
for line in open(W + "/../data/dict.txt", encoding="utf-8"):
    w, v = line.rstrip("\n").split("|")
    D[w] = v.split(";")
toks = lambda tr: [t.lstrip("ˈˌ") for t in tr.split()]
main = lambda w: toks(next((tr for tr in D[w] if "ˈ" in tr), D[w][0]))
VOWELS = {"iː","i","ɪ","e","æ","ʌ","ɑː","ɒ","ɔː","ʊ","uː","ɜː","ə","eɪ","aɪ","ɔɪ","əʊ","aʊ","ɪə","eə","ʊə"}
P = json.load(open(W + "/phonemes.json"))
print("phonemes:", len(P))
norm = lambda t: "iː" if t == "i" else t
for p in P:
    for w in p["ex"] + [p["kw"]] + [s[1] for s in p["sp"]]:
        if w.lower() not in D: print("  MISSING", p["id"], w); continue
        if not any(p["id"] in [norm(t) for t in toks(tr)] for tr in D[w.lower()]):
            print("  NO-PHONEME", p["id"], w, D[w.lower()])
pairs = json.load(open(W + "/pairs.json"))
seen = set()
for s in pairs:
    for a, b in s["pairs"]:
        if (s["id"], a, b) in seen: print("  PAIR-DUP", s["id"], a, b)
        seen.add((s["id"], a, b))
        if a not in D or b not in D: print("  PAIR-MISSING", s["id"], a, b); continue
        ta, tb = main(a), main(b)
        if s["b"] is None:
            ok = ta[0] == "h" and ta[1:] == tb
        else:
            ok = len(ta) == len(tb) and [(x, y) for x, y in zip(ta, tb) if x != y] == [(s["a"], s["b"])]
        if not ok: print("  PAIR-BAD", s["id"], a, ta, b, tb)
print("pairs:", len(seen), {s["id"]: len(s["pairs"]) for s in pairs})
sets = {s["id"] for s in pairs}
sent = json.load(open(W + "/sentences.json"))
words = re.compile(r"[A-Za-z][A-Za-z']*")
CONTRACTED = {"i've", "we're", "i'd", "i'll"}
def known(w):
    w = w.lower()
    return w in D or w in CONTRACTED or w.replace("'s", "") in D
for s in sent:
    if s["set"] not in sets: print("  SENT-SET", s)
    if "___" not in s["t"]: print("  SENT-BLANK", s)
    for w in words.findall(s["t"]) + s["pair"]:
        if not known(w): print("  SENT-WORD", s["id"], w)
print("sentences:", len(sent))
weak = json.load(open(W + "/weak.json"))
for s in weak:
    for w in words.findall(s["t"]) + [s["w"]] + s["alts"]:
        if not known(w): print("  WEAK-WORD", s["id"], w)
print("weak:", len(weak))
stress = json.load(open(W + "/stress.json"))
good = 0
for s in stress:
    w = s.replace("-", "").lower()
    if w not in D: print("  STRESS-MISSING", s); continue
    n = sum(t in VOWELS for t in main(w))
    if n != len(s.split("-")): print("  STRESS-SYLL", s, n, D[w]); continue
    good += 1
print("stress:", good, "of", len(stress))
