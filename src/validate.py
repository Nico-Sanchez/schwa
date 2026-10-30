import json, sys
W = sys.argv[1]
D = {}
for line in open(W + "/../data/dict.txt", encoding="utf-8"):
    w, v = line.rstrip("\n").split("|")
    D[w] = [[t.lstrip("ˈˌ") for t in tr.split()] for tr in v.split(";")]
P = json.load(open(W + "/phonemes.json"))
print("phonemes:", len(P))
norm = lambda t: "iː" if t == "i" else t
for p in P:
    for w in p["ex"] + [p["kw"]] + [s[1] for s in p["sp"]]:
        if w.lower() not in D: print("  MISSING", p["id"], w); continue
        if not any(p["id"] in [norm(t) for t in tr] for tr in D[w.lower()]):
            print("  NO-PHONEME", p["id"], w, [" ".join(tr) for tr in D[w.lower()]])
for s in json.load(open(W + "/pairs.json")):
    for a, b in s["pairs"]:
        if a not in D or b not in D: print("  PAIR-MISSING", s["id"], a, b); continue
        ok = False
        for ta in D[a]:
            for tb in D[b]:
                if s["b"] is None:
                    ok |= ta[0] == "h" and ta[1:] == tb
                elif len(ta) == len(tb):
                    diff = [(x, y) for x, y in zip(ta, tb) if x != y]
                    ok |= diff == [(s["a"], s["b"])]
        if not ok: print("  PAIR-BAD", s["id"], a, D[a], b, D[b])
