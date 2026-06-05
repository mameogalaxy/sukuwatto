/**
 * Service Worker（PWA / Android アプリ化・オフライン対応）
 *
 * 方針: network-first。オンライン時は常に最新を取得し、取得物をキャッシュ。
 * オフライン時のみキャッシュ(なければ index.html)を返す。
 * → 反映が遅れる事故を避けつつ、オフラインでも起動できる。
 * CDN(MediaPipe 等の別オリジン)は介入しない。
 */
const CACHE = "sukuwatto-v22";
const SHELL = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 別オリジン(CDN)は素通し

  e.respondWith((async () => {
    try {
      const net = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, net.clone());
      return net;
    } catch (_) {
      const cached = await caches.match(req);
      return cached || caches.match("./index.html");
    }
  })());
});
