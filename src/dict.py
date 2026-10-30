import sys, re, collections
src, out = sys.argv[1], sys.argv[2]
MAP = {"ɐ":"ʌ","ɹ":"r","ɛ":"e","ɛə":"eə"}
entries = collections.OrderedDict()
for line in open(src, encoding="utf-8"):
    line = line.rstrip("\n")
    if not line or "," not in line: continue
    w, p = line.split(",", 1)
    w = re.sub(r"\(\d+\)$", "", w.strip()).lower()
    if "_" in w or not re.search(r"[a-z]", w): continue
    toks = []
    for t in p.split():
        st = ""
        if t[0] in "ˈˌ": st, t = t[0], t[1:]
        toks.append(st + MAP.get(t, t))
    entries.setdefault(w, [])
    tr = " ".join(toks)
    if tr not in entries[w]: entries[w].append(tr)
with open(out, "w", encoding="utf-8") as f:
    f.write("\n".join(w + "|" + ";".join(v) for w, v in entries.items()))
syms = collections.Counter(t.lstrip("ˈˌ") for v in entries.values() for tr in v for t in tr.split())
print(len(entries), "words;", sorted(syms))
