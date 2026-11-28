// يحفظ الموقع وكل المصاحف على الجهاز عند أول فتح، فيعمل بعدها دون اتصال
const C='q10-v85';
const F=['./','index.html','app.js','app.css','manifest.webmanifest','icon.svg','fonts/Amiri-Regular.ttf','fonts/AmiriQuran-Regular.ttf','data/riwayat.json','data/m/base.json','data/m/sila.json','data/m/hisham.json','data/m/warsh.json','data/m/shuba.json','data/m/duri.json','data/m/khalaf.json','data/m/kisai.json','data/m/khalaf10.json','data/m/yaqub.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C&&!k.startsWith('q10-data-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
  e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{if(r.ok){const k=r.clone();caches.open(C).then(c=>c.put(e.request,k));}return r})
   .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))));});
