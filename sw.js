/**
 * 自己消去 Service Worker
 *
 * 以前のバージョンで入れたキャッシュ型 SW が、同じ GitHub Pages の URL
 * (/sukuwatto/) 配下で別プロジェクトを開いたときに「古いアプリが居座る」
 * 原因になっていたため、ここでは何もキャッシュせず、自分自身を解除して
 * 既存キャッシュを全削除する。
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((c) => c.navigate(c.url)); // 最新を素のネットワークから読み直す
    } catch (_) {}
  })());
});

// フェッチには一切介入しない(常にネットワーク=現在公開中の中身を表示)
