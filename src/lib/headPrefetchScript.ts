import { PUBLIC_CACHE_KEY, PUBLIC_CACHE_TTL_MS } from '../data/cacheConfig.ts';

export function buildHeadPrefetchScript(cfg: {
  apiKey: string;
  projectId: string;
  databaseId: string;
}): string {
  if (!cfg.apiKey || !cfg.projectId) return '';

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

    var apiKey = ${JSON.stringify(cfg.apiKey)};
    var base = 'https://firestore.googleapis.com/v1/projects/' +
      encodeURIComponent(${JSON.stringify(cfg.projectId)}) +
      '/databases/' +
      encodeURIComponent(${JSON.stringify(cfg.databaseId)}) +
      '/documents';
    var keySuffix = '?key=' + encodeURIComponent(apiKey);

    var decodeVal = function(v) {
      if (!v || typeof v !== 'object') return null;
      if ('stringValue' in v) return v.stringValue;
      if ('integerValue' in v) return Number(v.integerValue);
      if ('doubleValue' in v) return Number(v.doubleValue);
      if ('booleanValue' in v) return v.booleanValue;
      if ('timestampValue' in v) return v.timestampValue;
      if ('nullValue' in v) return null;
      if ('arrayValue' in v) {
        var vals = (v.arrayValue && v.arrayValue.values) || [];
        return vals.map(decodeVal);
      }
      if ('mapValue' in v) {
        return decodeMap((v.mapValue && v.mapValue.fields) || {});
      }
      return null;
    };
    var decodeMap = function(fields) {
      var out = {};
      if (!fields) return out;
      var keys = Object.keys(fields);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        out[k] = decodeVal(fields[k]);
      }
      return out;
    };

    var bridge = window.__BETHEL_PREFETCH__ = window.__BETHEL_PREFETCH__ || {};
    bridge.bundlePromise = fetch(base + '/church_sections/public_bundle' + keySuffix, {
      mode: 'cors',
      credentials: 'omit'
    }).then(function(res) {
      if (res.status === 404) {
        var nf = { status: 'not-found' };
        bridge.resolvedResult = nf;
        return nf;
      }
      if (res.status === 429) {
        var qe429 = { status: 'quota-exceeded' };
        bridge.resolvedResult = qe429;
        return qe429;
      }
      if (!res.ok) {
        return res.text().then(function(bodyText) {
          var lower = (bodyText || '').toLowerCase();
          if (lower.indexOf('resource_exhausted') !== -1 || lower.indexOf('quota') !== -1) {
            var qe = { status: 'quota-exceeded' };
            bridge.resolvedResult = qe;
            return qe;
          }
          throw new Error('HTTP ' + res.status);
        });
      }
      return res.json().then(function(doc) {
        var bundle = decodeMap(doc && doc.fields);
        var hero = bundle && bundle.churchInfo && bundle.churchInfo.heroImage;
        if (typeof hero === 'string') {
          var h = hero.trim();
          var m = h.match(/^media:\\/\\/([a-zA-Z0-9_-]+)\\/([1-9][0-9]?)$/);
          if (m) {
            var mediaId = m[1];
            var total = Number(m[2]);
            if (total > 0 && total <= 30) {
              var chunkReqs = [];
              for (var i = 0; i < total; i++) {
                chunkReqs.push(
                  fetch(base + '/media_chunks/' + encodeURIComponent(mediaId + '__' + i) + keySuffix, {
                    mode: 'cors',
                    credentials: 'omit'
                  }).then(function(r) {
                    if (!r.ok) return null;
                    return r.json().then(function(cd) {
                      return cd && cd.fields && cd.fields.data && cd.fields.data.stringValue || null;
                    });
                  })
                );
              }
              bridge.heroMedia = {
                uri: h,
                promise: Promise.all(chunkReqs).then(function(parts) {
                  for (var j = 0; j < parts.length; j++) {
                    if (!parts[j]) return null;
                  }
                  return parts;
                }).catch(function() { return null; })
              };
            }
          } else {
            preloadImageUrl(h);
          }
        }
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
