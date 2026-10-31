import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { buildRound, grade, spread, dueCount, dailyStreak } = createRequire(import.meta.url)("../src/logic.js");

const seeded = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const keys = n => Array.from({ length: n }, (_, i) => `set:${i}`);

test("a round never repeats an item", () => {
  const rng = seeded(1);
  for (let i = 0; i < 2000; i++) {
    const { items } = buildRound({ keys: keys(12), rng });
    assert.equal(items.length, 10);
    assert.equal(new Set(items).size, 10);
  }
});

test("small sets shorten the round instead of repeating", () => {
  const { items } = buildRound({ keys: keys(3), rng: seeded(2) });
  assert.equal(items.length, 3);
  assert.equal(new Set(items).size, 3);
});

test("consecutive rounds exhaust the deck before anything comes back", () => {
  const rng = seeded(3), all = keys(30), seen = new Set();
  let deck = [];
  for (let r = 0; r < 3; r++) {
    const out = buildRound({ keys: all, deck, rng });
    deck = out.deck;
    out.items.forEach(k => { assert.ok(!seen.has(k), k); seen.add(k); });
  }
  assert.equal(seen.size, 30);
});

test("the last items of a deck are not repeated when it refills mid-round", () => {
  const rng = seeded(4), all = keys(12);
  let deck = [];
  for (let r = 0; r < 500; r++) {
    const out = buildRound({ keys: all, deck, rng });
    assert.equal(new Set(out.items).size, 10);
    deck = out.deck;
  }
});

test("a missed item comes back in the next round", () => {
  const rng = seeded(5), all = keys(40), cards = {};
  const first = buildRound({ keys: all, rng });
  const missed = first.items[3];
  cards[missed] = grade(null, false, 100);
  const next = buildRound({ keys: all, deck: first.deck, cards, day: 100, rng });
  assert.ok(next.items.includes(missed));
});

test("correct answers wait longer each time", () => {
  let c = null;
  const dues = [];
  for (let i = 0; i < 5; i++) { c = grade(c, true, 0); dues.push(c.due); }
  assert.deepEqual(dues, [1, 3, 7, 21, 21]);
  assert.equal(grade(c, false, 50).box, 0);
  assert.equal(grade(c, false, 50).due, 50);
});

test("reviews take at most half of the round", () => {
  const all = keys(40), cards = Object.fromEntries(all.map(k => [k, { box: 1, due: 0, n: 1, ok: 1 }]));
  const fresh = keys(80).slice(40), rng = seeded(6);
  const { items } = buildRound({ keys: [...all, ...fresh], cards, day: 5, deck: fresh, rng });
  assert.equal(items.filter(k => cards[k]).length, 5);
});

test("a mixed round caps each contrast and avoids neighbours", () => {
  const rng = seeded(7), all = [];
  for (let s = 0; s < 12; s++) for (let i = 0; i < 12; i++) all.push(`${s}:${i}`);
  const groupOf = k => k.split(":")[0];
  for (let r = 0; r < 500; r++) {
    const { items } = buildRound({ keys: all, groupOf, rng });
    const tally = {};
    items.forEach(k => tally[groupOf(k)] = (tally[groupOf(k)] || 0) + 1);
    assert.ok(Math.max(...Object.values(tally)) <= 2);
    items.slice(1).forEach((k, i) => assert.notEqual(groupOf(k), groupOf(items[i])));
  }
});

test("weak contrasts come up more often", () => {
  const rng = seeded(8), all = [];
  for (let s = 0; s < 4; s++) for (let i = 0; i < 30; i++) all.push(`${s}:${i}`);
  const groupOf = k => k.split(":")[0], tally = {};
  let deck = [];
  for (let r = 0; r < 300; r++) {
    const out = buildRound({ keys: all, groupOf, deck, rng, weight: g => g === "0" ? 5 : 1 });
    deck = out.deck;
    out.items.forEach(k => tally[groupOf(k)] = (tally[groupOf(k)] || 0) + 1);
  }
  assert.ok(tally["0"] > tally["1"]);
});

test("spread keeps every item", () => {
  const items = ["a:1", "a:2", "a:3", "b:1", "c:1"];
  assert.deepEqual([...spread(items, k => k[0])].sort(), [...items].sort());
});

test("dueCount only counts what is due", () => {
  assert.equal(dueCount(["a", "b", "c"], { a: { due: 1 }, b: { due: 9 } }, 5), 1);
});

test("the daily streak grows on consecutive days and resets after a gap", () => {
  let log = dailyStreak({}, 10);
  assert.equal(log.streak, 1);
  log = dailyStreak(log, 11);
  assert.equal(log.streak, 2);
  assert.equal(dailyStreak(log, 11).streak, 2);
  assert.equal(dailyStreak(log, 14).streak, 1);
});
