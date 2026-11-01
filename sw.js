// Service worker: halaman = jaringan dulu (fallback cache), aset statis = cache lalu perbarui di belakang.
const CACHE = 'dazpro-v7';
const CORE = [
  './',
  'index.html',
  'css/style.css',
  'manifest.webmanifest',
  'assets/logo.png',
  'assets/favicon.png',
  'fonts/index.json',
  'fonts/poppins.json',
  'js/config.js',
  'js/dims.js',
  'js/engine.js',
  'js/environment.js',
  'js/firebase.js',
  'js/fonts.js',
  'js/gallery.js',
  'js/icons.js',
  'js/main.js',
  'js/materials.js',
  'js/pricing.js',
  'js/props.js',
  'js/quote.js',
  'js/signage.js',
  'js/templates.js',
  'vendor/three/three.module.min.js',
  'vendor/three/addons/controls/OrbitControls.js',
  'vendor/three/addons/environments/RoomEnvironment.js',
  'vendor/three/addons/geometries/RoundedBoxGeometry.js',
  'vendor/three/addons/math/SimplexNoise.js',
  'vendor/three/addons/postprocessing/EffectComposer.js',
  'vendor/three/addons/postprocessing/GTAOPass.js',
  'vendor/three/addons/postprocessing/MaskPass.js',
  'vendor/three/addons/postprocessing/OutputPass.js',
  'vendor/three/addons/postprocessing/Pass.js',
  'vendor/three/addons/postprocessing/RenderPass.js',
  'vendor/three/addons/postprocessing/ShaderPass.js',
  'vendor/three/addons/postprocessing/UnrealBloomPass.js',
  'vendor/three/addons/shaders/CopyShader.js',
  'vendor/three/addons/shaders/GTAOShader.js',
  'vendor/three/addons/shaders/LuminosityHighPassShader.js',
  'vendor/three/addons/shaders/OutputShader.js',
  'vendor/three/addons/shaders/PoissonDenoiseShader.js',
  'vendor/three/addons/utils/BufferGeometryUtils.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // Firebase, font Google, dll. tidak di-cache
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req);
    const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
