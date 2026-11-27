import { PUBLIC_CACHE_KEY, PUBLIC_CACHE_TTL_MS } from '../data/cacheConfig.ts';

export function buildHeadPrefetchScript(): string {
  return `<script>
(function(){
  try {
    if (location.pathname === '/admin' || location.hash === '#admin') return;
    var CACHE_KEY = ${JSON.stringify(PUBLIC_CACHE_KEY)};
    var TTL = ${JSON.stringify(PUBLIC_CACHE_TTL_MS)};
    var preloadImageUrl = function(url) {
      if (!url || typeof url !== 'string') return;
      var u = url.trim();
      if (!/^(\\/[^\\/]|https?:\\/\\/).+$/.test(u)) return;
      var l = document.createElement('link');
      l.rel = 'preload';
      l.as = 'image';
      l.href = u;
      l.setAttribute('fetchpriority', 'high');
      document.head.appendChild(l);
    };
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        var cached = JSON.parse(raw);
        if (cached && typeof cached.cachedAt === 'number' && Date.now() - cached.cachedAt < TTL) {
          var cachedHero = cached.bundle && cached.bundle.churchInfo && cached.bundle.churchInfo.heroImage;
          preloadImageUrl(cachedHero);
          return;
        }
      }
    } catch (_) {}

    var bridge = window.__BETHEL_PREFETCH__ = window.__BETHEL_PREFETCH__ || {};
    bridge.bundlePromise = fetch('/api/public-bundle', {
      headers: { Accept: 'application/json' }
    }).then(function(res) {
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      return res.json().then(function(payload) {
        if (!payload || !payload.exists || !payload.bundle) {
          var nf = { status: 'not-found' };
          bridge.resolvedResult = nf;
          return nf;
        }
        var bundle = payload.bundle;
        var hero = bundle && bundle.churchInfo && bundle.churchInfo.heroImage;
        preloadImageUrl(hero);
        var ok = { status: 'ok', bundle: bundle };
        bridge.resolvedResult = ok;
        return ok;
      });
    }).catch(function() {
      var err = { status: 'error' };
      bridge.resolvedResult = err;
      return err;
    });
  } catch (_) {}
})();
</script>`;
}
