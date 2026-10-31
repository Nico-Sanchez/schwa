import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const A = createRequire(import.meta.url)("../src/analysis.js");

const seeded = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
function resonate(x, sr, freq, bw) {
  const r = Math.exp(-Math.PI * bw / sr), c = 2 * r * Math.cos(2 * Math.PI * freq / sr), d = -r * r, y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = (1 - c - d) * x[i] + c * (y[i - 1] || 0) + d * (y[i - 2] || 0);
  return y;
}
function vowel(f1, f2, sr, f0 = 120, seconds = .5) {
  const n = Math.round(sr * seconds), src = new Float32Array(n), period = Math.round(sr / f0);
  for (let i = 0; i < n; i += period) src[i] = 1;
  const y = resonate(resonate(resonate(src, sr, f1, 80), sr, f2, 100), sr, 2800, 150);
  const peak = A.peakOf(y);
  return y.map(v => v / peak * .5);
}
function noise(n, rng) { return Float32Array.from({ length: n }, () => rng() * 2 - 1); }
function highpass(x, cut, sr) {
  const y = new Float32Array(x.length), a = sr / (sr + 2 * Math.PI * cut);
  for (let i = 1; i < x.length; i++) y[i] = a * (y[i - 1] + x[i] - x[i - 1]);
  return y;
}
function fricative(cut, sr, seconds = 1, voice = 0) {
  const n = Math.round(sr * seconds), rng = seeded(11), hiss = highpass(highpass(highpass(noise(n, rng), cut, sr), cut, sr), cut, sr);
  const peak = A.peakOf(hiss);
  return hiss.map((v, i) => v / peak * .3 + voice * Math.sin(2 * Math.PI * 130 * i / sr));
}
function pad(x, sr) {
  const y = new Float32Array(x.length + sr);
  y.set(x, sr / 2);
  return y;
}

test("a quiet recording reaches the model level", () => {
  const x = pad(vowel(500, 1500, 16000).map(v => v * .01), 16000), { samples } = A.normalizeRecording(x);
  const db = 20 * Math.log10(A.activeLevel(samples));
  assert.ok(Math.abs(db - A.REC_LEVEL_DB) < 1.5, String(db));
});

test("normalizing trims silence and never clips", () => {
  const x = pad(vowel(500, 1500, 16000).map(v => v * 1.8), 16000), { samples } = A.normalizeRecording(x);
  assert.ok(samples.length < x.length * .75);
  assert.ok(A.peakOf(samples) <= .9);
});

test("wavBytes writes a valid mono header", () => {
  const b = A.wavBytes(new Float32Array([0, .5, -.5]), 24000), v = new DataView(b);
  assert.equal(b.byteLength, 50);
  assert.equal(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3)), "RIFF");
  assert.equal(v.getUint32(24, true), 24000);
  assert.equal(v.getInt16(46, true), 16383);
});

for (const [f1, f2] of [[300, 2300], [700, 1300], [350, 900], [550, 1750]]) {
  test(`formants of a ${f1}/${f2} vowel are recovered`, () => {
    const m = A.measureVowel(pad(vowel(f1, f2, 11025), 11025), 11025);
    assert.ok(Math.abs(m.f1 - f1) / f1 < .3, `${m.f1}`);
    assert.ok(Math.abs(m.f2 - f2) / f2 < .12, `${m.f2}`);
  });
}

const cal = { i: { f1: 290, f2: 2300 }, a: { f1: 750, f2: 1350 }, u: { f1: 320, f2: 800 } };

test("calibration vowels land on the map corners", () => {
  assert.equal(+A.vowelPoint(cal.i, cal)[0].toFixed(2), 0);
  assert.ok(Math.abs(A.vowelPoint(cal.i, cal)[1]) < .1);
  assert.equal(+A.vowelPoint(cal.u, cal)[0].toFixed(2), 1);
  assert.equal(+A.vowelPoint(cal.a, cal)[1].toFixed(2), 1);
});

test("a bad calibration is rejected", () => {
  assert.ok(A.validCalibration(cal));
  assert.ok(!A.validCalibration({ ...cal, a: cal.i }));
  assert.ok(!A.validCalibration({ ...cal, u: null }));
});

const pos = { "iː": [.08, .06], "ɪ": [.2, .2], "æ": [.12, .86], "ʌ": [.5, .78] };

test("a vowel on target passes", () => {
  assert.equal(A.vowelVerdict("iː", [.1, .08], pos, ["ɪ"]).level, "good");
});

test("a vowel far from target gives one direction", () => {
  const v = A.vowelVerdict("æ", [.15, .3], pos, ["ʌ"]);
  assert.equal(v.key, "vd_open");
  assert.notEqual(v.level, "good");
});

test("a vowel closer to its rival names the rival", () => {
  assert.equal(A.vowelVerdict("æ", [.55, .75], pos, ["ʌ"]).vars.near, "ʌ");
});

test("length feedback only fires at the extremes", () => {
  assert.equal(A.lengthVerdict("short", 600).key, "vd_too_long");
  assert.equal(A.lengthVerdict("long", 120).key, "vd_too_short");
  assert.equal(A.lengthVerdict("short", 200), null);
  assert.equal(A.lengthVerdict("long", 350), null);
});

test("a hiss is read as voiceless and sharp", () => {
  const m = A.measureFricative(pad(fricative(5500, 16000), 16000));
  assert.ok(m.voiced < .2, String(m.voiced));
  assert.ok(m.hi > 4300, String(m.hi));
  assert.equal(A.fricativeVerdict("s", m).level, "good");
});

test("a hiss with voice underneath is read as voiced", () => {
  const m = A.measureFricative(pad(fricative(5500, 16000, 1, .3), 16000));
  assert.ok(m.voiced > .6, String(m.voiced));
  assert.equal(A.fricativeVerdict("z", m).level, "good");
});

test("/z/ without voice is told to buzz", () => {
  const m = A.measureFricative(pad(fricative(5500, 16000), 16000));
  const v = A.fricativeVerdict("z", m);
  assert.equal(v.key, "vd_no_voice");
  assert.equal(v.vars.r, "s");
});

test("/s/ with voice is told to use only air", () => {
  const m = A.measureFricative(pad(fricative(5500, 16000, 1, .3), 16000));
  assert.equal(A.fricativeVerdict("s", m).key, "vd_voice");
});

test("a short burst is not a held sound", () => {
  const m = A.measureFricative(pad(fricative(5500, 16000, .12), 16000));
  assert.equal(A.fricativeVerdict("v", m).key, m ? "vd_hold" : "vd_unclear");
});

test("a low hiss does not pass as /s/", () => {
  const hush = resonate(noise(16000, seeded(5)), 16000, 3000, 1400), peak = A.peakOf(hush);
  const m = A.measureFricative(pad(hush.map(v => v / peak * .3), 16000));
  assert.equal(A.fricativeVerdict("s", m).key, "vd_sh_like");
});

test("silence gives no measurement", () => {
  assert.equal(A.fricativeVerdict("s", A.measureFricative(new Float32Array(16000))).key, "vd_unclear");
});
