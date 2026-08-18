/* Service worker — Critik Famille
   Stratégie « réseau d'abord » : on essaie toujours le réseau (pour avoir la
   dernière version et les données Supabase en direct), et on se rabat sur le
   cache si on est hors ligne. On ne met en cache que les fichiers de l'appli. */
var CACHE = "critik-famille-v2";
var SHELL = ["./", "./index.html", "./styles.css", "./config.js", "./app.js", "./icon.svg", "./manifest.json"];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(SHELL).catch(function(){}); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){ if(k!==CACHE) return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;
  var url = new URL(req.url);
  // On ne gère que les fichiers de notre propre site ; le reste (Supabase, TMDB…) passe normalement.
  if(url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(function(res){
      var copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(req, copy).catch(function(){}); });
      return res;
    }).catch(function(){ return caches.match(req).then(function(m){ return m || caches.match("./index.html"); }); })
  );
});
