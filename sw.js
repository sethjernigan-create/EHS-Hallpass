/* Cache only this app's static files. Never cache Cognito forms or requests. */
const CACHE='hall-camera-v3';
const FILES=['./','./index.html','./mobile.css','./hall-core.js','./camera.js','./vendor/zxing-browser.min.js','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png'];
const allowed=new Set(FILES.map(p=>new URL(p,self.registration.scope).href));
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>/^hall-(?:v\d|camera-)/.test(k)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||!allowed.has(e.request.url))return;
  e.respondWith(caches.open(CACHE).then(async c=>{
    if(e.request.mode==='navigate'){
      try{const r=await fetch(e.request);if(r.ok){await c.put(e.request,r.clone());return r;}}catch{}
      return (await c.match(e.request))||(await c.match('./index.html'));
    }
    const cached=await c.match(e.request);if(cached)return cached;
    const response=await fetch(e.request);if(response.ok)await c.put(e.request,response.clone());return response;
  }));
});
