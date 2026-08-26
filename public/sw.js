const CACHE = 'rockmundo-shell-v2';
const SHELL = ['/', '/mobile', '/manifest.webmanifest', '/placeholder.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Only navigations may fall back to the cached app shell. Returning HTML for
  // failed JS/CSS/image requests makes browsers report chunk/module load errors,
  // which can trigger the app's chunk recovery path and force a full-page reload.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedRequest = await caches.match(request);
        if (cachedRequest) return cachedRequest;

        const shell = url.pathname.startsWith('/mobile') ? '/mobile' : '/';
        const cachedShell = await caches.match(shell);
        if (cachedShell) return cachedShell;

        return Response.error();
      })
    );
    return;
  }

  // Static assets must either return their exact cached response or fail as an
  // asset request. Never substitute the HTML shell for a script/module request.
  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(request);
      return cached || Response.error();
    })
  );
});
