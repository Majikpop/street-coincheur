/* Service worker de Street Coincheur : garde le jeu sur le téléphone pour qu'il s'ouvre sans réseau.
 *
 * - La page (index.html) : réseau d'abord, pour recevoir les mises à jour dès qu'on est en ligne ;
 *   la copie gardée ne sert que si le réseau ne répond pas (hors ligne, ou plus de 4 s).
 * - Les scripts et la feuille de style portent un numéro de version (?v=) : une fois gardés, ils ne changent
 *   plus, on les sert depuis le téléphone. À chaque nouvelle page reçue, les fichiers d'une autre version sont effacés.
 * - Les polices Google : gardées à la première lecture.
 * - Firebase (SDK et serveur) n'est pas intercepté : hors ligne, son chargement échoue et le jeu passe en mode
 *   hors ligne (voir boot() dans app.js).
 */
const CACHE = 'sc-v1';
const SCOPE = self.registration.scope;              // ex. https://majikpop.github.io/street-coincheur/
const PAGE = new URL('./', SCOPE).href;             // clé unique de la page, quelle que soit l'adresse ouverte
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

/** Fichiers à garder pour une version de la page : scripts, styles, manifeste, icônes, et les polices. */
function assetsOf(html) {
  const out = new Set();
  for (const m of html.matchAll(/<(?:script|link)\b[^>]*?\s(?:src|href)="([^"]+)"/g)) {
    const u = new URL(m[1], SCOPE);
    if (u.origin === location.origin || u.hostname === 'fonts.googleapis.com' && u.pathname.startsWith('/css')) out.add(u.href);
  }
  return [...out];
}
const verOf = html => (html.match(/app\.js\?v=([\w.-]+)/) || [])[1] || null;

async function storeFonts(cache, cssUrl, res) {
  const css = await res.clone().text();
  const files = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]);
  await Promise.all(files.map(f => cache.match(f).then(hit => hit || fetch(f).then(r => r.ok && cache.put(f, r))).catch(() => {})));
}

/** Garde la page et tout ce qu'elle charge. Une ressource injoignable n'empêche pas les autres. */
async function storeVersion(html) {
  const cache = await caches.open(CACHE);
  await Promise.all(assetsOf(html).map(async url => {
    if (await cache.match(url)) return;
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) return;
      if (new URL(url).hostname === 'fonts.googleapis.com') await storeFonts(cache, url, res);
      await cache.put(url, res);
    } catch (e) {}
  }));
  // Ménage : les fichiers du site marqués d'une autre version ne serviront plus.
  const ver = verOf(html);
  if (!ver) return;
  for (const req of await cache.keys()) {
    const u = new URL(req.url);
    if (u.origin === location.origin && u.searchParams.has('v') && u.searchParams.get('v') !== ver) await cache.delete(req);
  }
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const res = await fetch(PAGE, { cache: 'no-cache' });
    if (!res.ok) throw new Error('page ' + res.status);
    const html = await res.clone().text();
    await (await caches.open(CACHE)).put(PAGE, res);
    await storeVersion(html);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k.startsWith('sc-')) await caches.delete(k);
    await self.clients.claim();
  })());
});

const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('délai')), ms))]);

async function page(req) {
  const cache = await caches.open(CACHE);
  const net = fetch(req).then(async res => {
    if (res.ok && res.type === 'basic') {
      const html = await res.clone().text();
      await cache.put(PAGE, res.clone());
      storeVersion(html).catch(() => {});
    }
    return res;
  });
  try { return await timeout(net, 4000); }
  catch (e) {
    const hit = await cache.match(PAGE);
    if (hit) { net.catch(() => {}); return hit; }
    return net; // rien de gardé : on attend le réseau jusqu'au bout
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') {
    if (new URL(req.url).hostname === 'fonts.googleapis.com') await storeFonts(cache, req.url, res).catch(() => {});
    await cache.put(req, res.clone());
  }
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(req, res.clone());
    return res;
  } catch (e) {
    return (await cache.match(req)) || Response.error();
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (req.mode === 'navigate' && u.origin === location.origin) return e.respondWith(page(req));
  if (u.origin === location.origin) {
    // Vérification de version de app.js (?nv=) : toujours le réseau, jamais la copie.
    if (u.searchParams.has('nv')) return;
    if (u.searchParams.has('v')) return e.respondWith(cacheFirst(req).catch(() => Response.error()));
    return e.respondWith(networkFirst(req)); // fichiers sans version (manifeste, images) : à jour si possible

  }
  if (FONT_HOSTS.includes(u.hostname)) return e.respondWith(cacheFirst(req).catch(() => Response.error()));
});
