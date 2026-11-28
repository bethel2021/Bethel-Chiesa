import {
  getCloudflareDb,
  getWorkersDefaultCache,
  type PagesContext,
} from '../_cfContext';
import { handleGetMedia } from '../_core';

const SAFE_MEDIA_KEY_REGEX = /^[a-zA-Z0-9_-]{4,120}\.(webp|jpg|jpeg|png)$/;

export async function onRequestGet(
  context: PagesContext<{ key?: string }>
): Promise<Response> {
  const key = typeof context.params?.key === 'string' ? context.params.key.trim() : '';
  if (!SAFE_MEDIA_KEY_REGEX.test(key)) {
    return new Response('Invalid media key', { status: 400 });
  }

  const ifNoneMatch = context.request.headers.get('if-none-match');
  const expectedEtag = `"media-${key}"`;
  const edgeCache = getWorkersDefaultCache();

  let cacheRequest: Request | null = null;
  if (edgeCache) {
    try {
      const canonicalUrl = new URL(context.request.url);
      canonicalUrl.search = '';
      cacheRequest = new Request(canonicalUrl.toString(), { method: 'GET' });

      const cached = await edgeCache.match(cacheRequest);
      if (cached) {
        const cachedEtag = cached.headers.get('etag') || expectedEtag;
        if (ifNoneMatch && ifNoneMatch.includes(cachedEtag)) {
          return new Response(null, {
            status: 304,
            headers: {
              etag: cachedEtag,
              'cache-control': 'public, max-age=31536000, immutable',
            },
          });
        }
        return cached;
      }
    } catch {
      // Fallback gracefully to D1 if Edge Cache lookup errors
      cacheRequest = null;
    }
  }

  const dbRes = await getCloudflareDb(context.env);
  if (dbRes.ok === false) return dbRes.response;

  const response = await handleGetMedia(dbRes.db, key, ifNoneMatch);

  if (edgeCache && cacheRequest && response.status === 200) {
    const putPromise = edgeCache.put(cacheRequest, response.clone()).catch(() => undefined);
    if (typeof context.waitUntil === 'function') {
      context.waitUntil(putPromise);
    } else {
      void putPromise;
    }
  }

  return response;
}
