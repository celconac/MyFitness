const CACHE='myfitness-20261015-native-v6';
const FILES=['./','./index.html','./native-google.js?v=20261015-native-v6','./app.js?v=20261015-native-v6','./googledrive.js?v=20261015-native-v6','./exercise-media.js?v=20261015-native-v6','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));
 // Wait for old tabs to close so app.js and the sync client update together.
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('myfitness-')&&key!==CACHE).map(key=>caches.delete(key)))));
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 const asset=FILES.some(file=>new URL(file,self.registration.scope).href===url.href);
 if(!asset&&event.request.mode!=='navigate')return;
 // Cache app assets only; Google requests and authorization responses never enter this cache.
 event.respondWith(fetch(event.request).catch(async()=>{
  const cached=await caches.match(event.request);
  if(cached)return cached;
  if(event.request.mode==='navigate')return caches.match(new URL('./index.html',self.registration.scope).href);
  return Response.error();
 }));
});
