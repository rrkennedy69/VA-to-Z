/* VA to Z — cache the app shell and icons so the page works offline.
   index.html is network-first so a published update is used when online. */
var CACHE = "va-to-z-v14";
var ICONS = [
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png"
];

function shellUrl() {
  return new URL("./index.html", self.location).href;
}

function isShell(url) {
  if (url.origin !== self.location.origin) return false;
  var path = url.pathname.replace(/\/+$/, "");
  var base = new URL("./", self.location).pathname.replace(/\/+$/, "");
  return path === base || path === base + "/index.html";
}

function isIcon(url) {
  if (url.origin !== self.location.origin) return false;
  return ICONS.some(function (icon) {
    return url.pathname.endsWith("/" + icon);
  });
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(["index.html"].concat(ICONS));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  if (isShell(url)) {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response && response.ok && response.type === "basic") {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) {
            return cache.put(shellUrl(), copy);
          });
        }
        return response;
      }).catch(function () {
        return caches.match(shellUrl()).then(function (cached) {
          return cached || new Response("VA to Z is not available offline yet. Open this page once while online.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=UTF-8" }
          });
        });
      })
    );
    return;
  }

  if (!isIcon(url)) return;

  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response && response.ok && response.type === "basic") {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) {
            return cache.put(request, copy);
          });
        }
        return response;
      }).catch(function () {
        return new Response("", { status: 504, headers: { "Content-Type": "image/png" } });
      });
    })
  );
});
