const CACHE="juranews-v10";
const SHELL=[
  "./",
  "./index.html",
  "./styles.css?v=20260923-4",
  "./app.js?v=20260923-4",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
  );
  self.clients.claim();
});

async function networkFirst(request){
  try{
    const response=await fetch(request,{cache:"no-store"});
    const cache=await caches.open(CACHE);
    cache.put(request,response.clone());
    return response;
  }catch{
    return (await caches.match(request)) || (await caches.match(request,{ignoreSearch:true}));
  }
}

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  if(
    event.request.mode==="navigate" ||
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/styles.css") ||
    url.pathname.endsWith("/manifest.webmanifest") ||
    url.pathname.includes("/data/")
  ){
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>{
      if(cached)return cached;
      return fetch(event.request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        return response;
      });
    })
  );
});
