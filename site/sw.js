const CACHE = "schwa-fdaf81564267";
const FONTS = "schwa-fonts";
const ASSETS = ["./", "index.html", "manifest.webmanifest", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "audio/aa.mp3", "audio/ae.mp3", "audio/b.mp3", "audio/ch.mp3", "audio/d.mp3", "audio/dh.mp3", "audio/dj.mp3", "audio/e.mp3", "audio/er.mp3", "audio/f.mp3", "audio/g.mp3", "audio/h.mp3", "audio/i.mp3", "audio/ii.mp3", "audio/k.mp3", "audio/l.mp3", "audio/m.mp3", "audio/n.mp3", "audio/ng.mp3", "audio/o.mp3", "audio/oo.mp3", "audio/p.mp3", "audio/r.mp3", "audio/s.mp3", "audio/schwa.mp3", "audio/sh.mp3", "audio/t.mp3", "audio/th.mp3", "audio/u.mp3", "audio/uh.mp3", "audio/uu.mp3", "audio/v.mp3", "audio/w.mp3", "audio/y.mp3", "audio/z.mp3", "audio/zh.mp3"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("schwa-") && k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Safari only plays cached audio when a Range request gets a real 206.
async function withRange(req, res) {
  const range = req.headers.get("range");
  if (!range || !res) return res;
  const buf = await res.arrayBuffer();
  const [, a, b] = /bytes=(\d*)-(\d*)/.exec(range) || [];
  const start = Number(a) || 0, end = b ? Number(b) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "audio/mpeg",
      "Content-Range": `bytes ${start}-${end}/${buf.byteLength}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin && req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put("./", res.clone());
        return res;
      } catch {
        return (await caches.match(req, { ignoreSearch: true })) || caches.match("./");
      }
    })());
  } else if (url.origin === location.origin) {
    e.respondWith((async () => {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return withRange(req, hit);
      try { return await fetch(req); }
      catch { return req.mode === "navigate" ? caches.match("./") : Response.error(); }
    })());
  } else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
