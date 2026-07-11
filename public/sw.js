// 최소 서비스 워커.
// 크롬이 PWA 설치 프롬프트(beforeinstallprompt)를 띄우려면 fetch 핸들러를 가진
// 서비스 워커가 등록되어 있어야 한다. 매출 데이터는 항상 최신이어야 하므로
// 캐싱은 하지 않고 네트워크로 그대로 통과시킨다.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // GET 이외(로그인/저장 등)는 건드리지 않는다.
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});
