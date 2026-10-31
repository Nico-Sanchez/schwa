const pick = (a, rng = Math.random) => a[Math.floor(rng() * a.length)];
const shuffle = (a, rng = Math.random) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const BOX_DAYS = [0, 1, 3, 7, 21];
const dayOf = ms => Math.floor(ms / 864e5);
function grade(card, ok, day) {
  const c = card || { box: 0, n: 0, ok: 0 };
  const box = ok ? Math.min(BOX_DAYS.length - 1, c.box + 1) : 0;
  return { box, due: day + BOX_DAYS[box], n: c.n + 1, ok: c.ok + (ok ? 1 : 0) };
}
const dueCount = (keys, cards, day) => keys.filter(k => cards[k]?.due <= day).length;
function weightedPick(options, weight, rng = Math.random) {
  const ws = options.map(o => Math.max(.01, weight(o)));
  let r = rng() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) { r -= ws[i]; if (r <= 0) return options[i]; }
  return options.at(-1);
}
function spread(items, groupOf) {
  const left = [...items], out = [];
  while (left.length) {
    const last = out.length ? groupOf(out.at(-1)) : null, tally = new Map();
    left.forEach(k => tally.set(groupOf(k), (tally.get(groupOf(k)) || 0) + 1));
    const ok = left.filter(k => groupOf(k) !== last), from = ok.length ? ok : left;
    const best = from.reduce((a, b) => tally.get(groupOf(b)) > tally.get(groupOf(a)) ? b : a);
    out.push(best); left.splice(left.indexOf(best), 1);
  }
  return out;
}
function buildRound({ keys, cards = {}, deck = [], day = 0, n = 10, groupOf = () => "", weight = () => 1, rng = Math.random }) {
  const live = new Set(keys), size = Math.min(n, live.size), counts = new Map(), out = [];
  const groups = new Map();
  live.forEach(k => groups.set(groupOf(k), [...(groups.get(groupOf(k)) || []), k]));
  let cap = groups.size > 1 ? Math.max(2, Math.ceil(size * 2 / groups.size)) : size;
  const room = g => (counts.get(g) || 0) < cap;
  const take = k => { out.push(k); counts.set(groupOf(k), (counts.get(groupOf(k)) || 0) + 1); };
  const overdue = k => day - cards[k].due;
  const due = shuffle([...live].filter(k => cards[k]?.due <= day), rng).sort((a, b) => overdue(b) - overdue(a));
  for (const k of due) { if (out.length >= Math.ceil(size / 2)) break; if (room(groupOf(k))) take(k); }
  let q = deck.filter(k => live.has(k) && !out.includes(k));
  while (out.length < size) {
    const open = [...groups.keys()].filter(g => room(g) && groups.get(g).some(k => !out.includes(k)));
    if (!open.length) { cap = Infinity; continue; }
    const g = weightedPick(open, weight, rng);
    if (!q.some(k => groupOf(k) === g)) q.push(...shuffle(groups.get(g).filter(k => !out.includes(k)), rng));
    const k = q.find(x => groupOf(x) === g);
    q = q.filter(x => x !== k);
    take(k);
  }
  return { items: spread(out, groupOf), deck: q };
}
const DAILY_PLAN = [["pair", 5], ["same", 2], ["sent", 2], ["stress", 1], ["weak", 1], ["dict", 1]];
function dailyStreak(log, day) {
  if (log.day === day) return log;
  return { day, streak: log.day === day - 1 ? (log.streak || 0) + 1 : 1 };
}
if (typeof module !== "undefined") module.exports = { pick, shuffle, grade, dueCount, weightedPick, spread, buildRound, dayOf, BOX_DAYS, DAILY_PLAN, dailyStreak };
