const REC_LEVEL_DB = -20;
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < h; k++) {
        const a = i + k, b = a + h, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nc = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nc;
      }
    }
  }
}
function rmsFrames(x, F = 256) {
  const out = [];
  for (let i = 0; i + F <= x.length; i += F) { let s = 0; for (let j = i; j < i + F; j++) s += x[j] * x[j]; out.push(Math.sqrt(s / F)); }
  return out;
}
const maxOf = a => a.reduce((m, v) => v > m ? v : m, 0);
function activeRange(x, F = 256, rel = .06) {
  const rms = rmsFrames(x, F), th = maxOf(rms) * rel, a = rms.findIndex(v => v > th);
  if (a < 0) return [0, x.length];
  let b = rms.length - 1;
  while (b > a && rms[b] <= th) b--;
  return [Math.max(0, (a - 3) * F), Math.min(x.length, (b + 4) * F)];
}
function activeLevel(x) {
  const rms = rmsFrames(x), th = maxOf(rms) * .1, on = rms.filter(v => v > th);
  return on.length ? Math.sqrt(on.reduce((s, v) => s + v * v, 0) / on.length) : 0;
}
function peakOf(x) { let p = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > p) p = v; } return p; }
function normalizeRecording(x, targetDb = REC_LEVEL_DB, ceiling = .89) {
  const [a, b] = activeRange(x), y = x.slice(a, b), peak = peakOf(y), level = activeLevel(y);
  const gain = Math.min(10 ** (targetDb / 20) / Math.max(level, 1e-6), ceiling / Math.max(peak, 1e-6));
  for (let i = 0; i < y.length; i++) y[i] *= gain;
  return { samples: y, peak, level };
}
function wavBytes(x, sr) {
  const buf = new ArrayBuffer(44 + x.length * 2), v = new DataView(buf);
  const tag = (o, s) => { for (let i = 0; i < 4; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  tag(0, "RIFF"); v.setUint32(4, 36 + x.length * 2, true); tag(8, "WAVE"); tag(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); tag(36, "data"); v.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 32767, true);
  return buf;
}
function lowpass(x, passes = 3, w = 8) {
  let y = x;
  for (let p = 0; p < passes; p++) {
    const o = new Float32Array(y.length);
    let s = 0;
    for (let i = 0; i < y.length; i++) { s += y[i]; if (i >= w) s -= y[i - w]; o[i] = s / Math.min(i + 1, w); }
    y = o;
  }
  return y;
}
function frameFeatures(x, sr = 16000) {
  const N = Math.round(sr * .03), hop = Math.round(sr * .01), M = 512, low = lowpass(x), lagMin = Math.floor(sr / 400), lagMax = Math.floor(sr / 70), out = [];
  const win = Float32Array.from({ length: N }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / (N - 1)));
  for (let s = 0; s + N + lagMax < x.length; s += hop) {
    let e = 0, eLow = 0;
    const re = new Float32Array(M), im = new Float32Array(M);
    for (let i = 0; i < N; i++) { e += x[s + i] * x[s + i]; eLow += low[s + i] * low[s + i]; re[i] = x[s + i] * win[i]; }
    let best = 0;
    for (let lag = lagMin; lag <= lagMax; lag++) {
      let c = 0, a = 0, b = 0;
      for (let i = 0; i < N; i++) { const p = low[s + i], q = low[s + i + lag]; c += p * q; a += p * p; b += q * q; }
      const r = c / Math.sqrt(a * b + 1e-12);
      if (r > best) best = r;
    }
    fft(re, im);
    let num = 0, den = 1e-12, hiNum = 0, hiDen = 1e-12;
    for (let k = 1; k < M / 2; k++) { const p = re[k] * re[k] + im[k] * im[k], f = k * sr / M; num += p * f; den += p; if (f >= 1000) { hiNum += p * f; hiDen += p; } }
    out.push({ rms: Math.sqrt(e / N), low: Math.sqrt(eLow / N), nccf: best, centroid: num / den, hi: hiNum / hiDen, hiShare: hiDen / den });
  }
  return out;
}
const isVoiced = (f, top) => f.nccf > .75 && f.low > top * .04;
function measureFricative(x, sr = 16000) {
  const fr = frameFeatures(x, sr), peak = maxOf(fr.map(f => f.rms)), top = maxOf(fr.map(f => f.low)), on = fr.map(f => f.rms > peak * .12), act = fr.filter((_, i) => on[i]);
  if (act.length < 5) return null;
  let run = 0, best = 0;
  on.forEach(v => { run = v ? run + 1 : 0; if (run > best) best = run; });
  return { ms: best * 10, voiced: act.filter(f => isVoiced(f, top)).length / act.length, hi: median(act.map(f => f.hi)), hiShare: median(act.map(f => f.hiShare)) };
}
const FRIC_PARTNER = { f: "v", v: "f", "θ": "ð", "ð": "θ", s: "z", z: "s", "ʃ": "ʒ", "ʒ": "ʃ" };
function fricativeVerdict(id, m) {
  if (!m) return { level: "try", key: "vd_unclear" };
  const voiced = "vðzʒ".includes(id), sharp = "sz".includes(id), hush = "ʃʒ".includes(id);
  if (m.ms < 220) return { level: "try", key: "vd_hold" };
  if (voiced && m.voiced < .3) return { level: "try", key: "vd_no_voice", vars: { r: FRIC_PARTNER[id] } };
  if (!voiced && m.voiced > .45) return { level: "try", key: "vd_voice", vars: { r: FRIC_PARTNER[id] } };
  if (m.hiShare < .02) return { level: "close", key: "vd_nofric" };
  if (sharp && m.hi < 4000) return { level: "close", key: "vd_sh_like" };
  if (hush && m.hi > 4900) return { level: "close", key: "vd_s_like" };
  return { level: "good", key: "vd_fric_ok" };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function vowelPoint(m, c) {
  const closed = (Math.log(c.i.f1) + Math.log(c.u.f1)) / 2;
  return [clamp((Math.log(c.i.f2) - Math.log(m.f2)) / (Math.log(c.i.f2) - Math.log(c.u.f2)), -.1, 1.1), clamp((Math.log(m.f1) - closed) / (Math.log(c.a.f1) - closed), -.1, 1.1)];
}
const validCalibration = c => !!(c.i && c.a && c.u && c.i.f2 > c.a.f2 * 1.2 && c.a.f2 > c.u.f2 * 1.08 && c.a.f1 > c.i.f1 * 1.3 && c.a.f1 > c.u.f1 * 1.3);
function lengthVerdict(kind, ms) {
  if (kind === "short" && ms > 450) return { level: "close", key: "vd_too_long" };
  if (kind === "long" && ms < 180) return { level: "close", key: "vd_too_short" };
  return null;
}
function vowelVerdict(id, pt, pos, rivals) {
  const dist = (a, b) => Math.hypot((a[0] - b[0]) * .7, a[1] - b[1]), goal = pos[id], mine = dist(pt, goal);
  const near = rivals.filter(r => pos[r]).map(r => [r, dist(pt, pos[r])]).sort((a, b) => a[1] - b[1])[0];
  if (mine <= .2 || (near && mine < near[1] * .6)) return { level: "good", key: "vd_ok_vowel", vars: { id } };
  const dx = pt[0] - goal[0], dy = pt[1] - goal[1];
  const key = Math.abs(dy) >= Math.abs(dx) * .7 ? (dy > 0 ? "vd_close_mouth" : "vd_open") : (dx > 0 ? "vd_front" : "vd_back");
  return { level: mine <= .35 ? "close" : "try", key, vars: near && near[1] < mine ? { near: near[0] } : {} };
}
function lpc(x, order) {
  const r = new Float64Array(order + 1);
  for (let k = 0; k <= order; k++) { let s = 0; for (let i = 0; i + k < x.length; i++) s += x[i] * x[i + k]; r[k] = s; }
  r[0] *= 1.0001;
  const a = new Float64Array(order + 1); a[0] = 1;
  let e = r[0];
  for (let i = 1; i <= order; i++) {
    let acc = r[i];
    for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
    const k = -acc / (e || 1e-12), prev = a.slice();
    for (let j = 1; j < i; j++) a[j] = prev[j] + k * prev[i - j];
    a[i] = k;
    e *= 1 - k * k;
  }
  return a;
}
function polyRoots(a) {
  const n = a.length - 1, zr = new Float64Array(n), zi = new Float64Array(n);
  for (let i = 0; i < n; i++) { const t = 2 * Math.PI * (i + .25) / n; zr[i] = .9 * Math.cos(t); zi[i] = .9 * Math.sin(t); }
  for (let it = 0; it < 80; it++) {
    let moved = 0;
    for (let i = 0; i < n; i++) {
      let pr = 1, pi = 0;
      for (let j = 1; j <= n; j++) { const t = pr * zr[i] - pi * zi[i] + a[j]; pi = pr * zi[i] + pi * zr[i]; pr = t; }
      let dr = 1, di = 0;
      for (let j = 0; j < n; j++) if (j !== i) { const xr = zr[i] - zr[j], xi = zi[i] - zi[j], t = dr * xr - di * xi; di = dr * xi + di * xr; dr = t; }
      const d = dr * dr + di * di + 1e-30, qr = (pr * dr + pi * di) / d, qi = (pi * dr - pr * di) / d;
      zr[i] -= qr; zi[i] -= qi; moved += Math.abs(qr) + Math.abs(qi);
    }
    if (moved < 1e-9) break;
  }
  return Array.from(zr, (r, i) => [r, zi[i]]);
}
function frameFormants(frame, sr) {
  const n = frame.length, w = new Float64Array(n);
  for (let i = 1; i < n; i++) w[i] = (frame[i] - .97 * frame[i - 1]) * (.54 - .46 * Math.cos(2 * Math.PI * i / (n - 1)));
  const out = [];
  for (const [re, im] of polyRoots(lpc(w, 12))) {
    if (im <= 0) continue;
    const f = Math.atan2(im, re) * sr / (2 * Math.PI), bw = -Math.log(Math.hypot(re, im)) * sr / Math.PI;
    if (f > 180 && f < sr / 2 - 200 && bw < 450) out.push(f);
  }
  return out.sort((a, b) => a - b);
}
const median = a => { const s = [...a].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : NaN; };
function measureVowel(x, sr = 11025) {
  const N = Math.round(sr * .03), hop = Math.round(sr * .01), rms = [];
  for (let s = 0; s + N <= x.length; s += hop) { let e = 0; for (let i = 0; i < N; i++) e += x[s + i] * x[s + i]; rms.push(Math.sqrt(e / N)); }
  const peak = maxOf(rms), on = rms.flatMap((v, i) => v > peak * .3 ? [i] : []);
  if (on.length < 6) return null;
  const a = on[Math.floor(on.length * .2)], b = on[Math.ceil(on.length * .8) - 1], f1 = [], f2 = [];
  for (let i = a; i <= b; i++) {
    const fm = frameFormants(x.subarray(i * hop, i * hop + N), sr);
    if (fm.length >= 2 && fm[0] < 1200 && fm[1] < 3400) { f1.push(fm[0]); f2.push(fm[1]); }
  }
  if (f1.length < 3) return null;
  return { f1: median(f1), f2: median(f2), ms: on.length * 10 };
}
if (typeof module !== "undefined") module.exports = { REC_LEVEL_DB, fft, rmsFrames, activeRange, activeLevel, peakOf, normalizeRecording, wavBytes, frameFeatures, measureFricative, fricativeVerdict, vowelPoint, validCalibration, lengthVerdict, vowelVerdict, lpc, polyRoots, frameFormants, measureVowel, median };
