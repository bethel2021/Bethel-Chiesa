import {
  DATA_IMAGE_URI_REGEX,
  MEDIA_URI_REGEX,
  SAFE_HTTP_OR_ROOT_RELATIVE_REGEX,
} from '../utils/urlSafety';
import { consumeEarlyHeroMediaChunks } from './earlyPrefetch';
import { firebasePublicConfig } from './firebase';

export { DATA_IMAGE_URI_REGEX, MEDIA_URI_REGEX };

const CACHE_NAME = 'bethel-church-media-v1';

const resolvedObjectUrls = new Map<string, string>();
const inFlightResolutions = new Map<string, Promise<string>>();
const preloadedExternalUrls = new Set<string>();

export function isMediaUri(src: string): boolean {
  return MEDIA_URI_REGEX.test(src.trim());
}

export function isD1MediaUrl(src: string): boolean {
  return /^\/api\/media\/[a-zA-Z0-9_-]{4,120}\.(webp|jpg|jpeg|png)$/.test(src.trim());
}

export function getCachedMediaObjectUrl(mediaUri: string): string | null {
  return resolvedObjectUrls.get(mediaUri.trim()) ?? null;
}

export async function dataUrlToBlobFast(dataUrl: string): Promise<Blob> {
  try {
    const response = await fetch(dataUrl);
    if (response.ok) {
      return await response.blob();
    }
  } catch {
    // Fallback to manual decode below
  }

  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    throw new Error('无效的图片编码格式。');
  }
  const header = dataUrl.slice(0, commaIdx);
  const base64 = dataUrl.slice(commaIdx + 1);
  const mimeMatch = header.match(/^data:([^;]+);base64$/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

async function putBlobInBrowserCache(mediaUri: string, blob: Blob): Promise<string> {
  const existing = resolvedObjectUrls.get(mediaUri);
  if (existing) {
    return existing;
  }

  const objectUrl = URL.createObjectURL(blob);
  resolvedObjectUrls.set(mediaUri, objectUrl);

  if (typeof window !== 'undefined' && 'caches' in window) {
    const match = mediaUri.match(MEDIA_URI_REGEX);
    if (match) {
      void window.caches
        .open(CACHE_NAME)
        .then((cache) =>
          cache.put(
            `https://bethel-media.local/${match[1]}/${match[2]}`,
            new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } })
          )
        )
        .catch(() => {
          // Ignore Cache API storage quota/private mode errors
        });
    }
  }

  return objectUrl;
}

async function fetchLegacyMediaDataUrlViaRest(mediaUri: string): Promise<string> {
  const match = mediaUri.trim().match(MEDIA_URI_REGEX);
  if (!match) {
    throw new Error('无效的旧版图片引用格式。');
  }
  const mediaId = match[1];
  const totalChunks = Number(match[2]);
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebasePublicConfig.projectId
  )}/databases/${encodeURIComponent(firebasePublicConfig.firestoreDatabaseId)}/documents/media_chunks`;
  const keyParam = firebasePublicConfig.apiKey
    ? `?key=${encodeURIComponent(firebasePublicConfig.apiKey)}`
    : '';

  const parts = await Promise.all(
    Array.from({ length: totalChunks }, async (_, idx) => {
      const res = await fetch(`${base}/${encodeURIComponent(`${mediaId}__${idx}`)}${keyParam}`);
      if (!res.ok) {
        throw new Error(`读取旧版图片分片失败（HTTP ${res.status}）`);
      }
      const docJson = (await res.json()) as {
        fields?: { data?: { stringValue?: string } };
      };
      const val = docJson.fields?.data?.stringValue;
      if (!val) {
        throw new Error('旧版图片分片数据为空。');
      }
      return val;
    })
  );

  const fullDataUrl = parts.join('');
  if (!DATA_IMAGE_URI_REGEX.test(fullDataUrl)) {
    throw new Error('旧版图片编码校验失败。');
  }
  return fullDataUrl;
}

export async function resolveLegacyMediaToBlob(mediaUri: string): Promise<Blob> {
  const fullDataUrl = await fetchLegacyMediaDataUrlViaRest(mediaUri);
  return await dataUrlToBlobFast(fullDataUrl);
}

export async function resolveMediaUri(mediaUri: string): Promise<string> {
  const normalized = mediaUri.trim();
  const cachedMem = resolvedObjectUrls.get(normalized);
  if (cachedMem) {
    return cachedMem;
  }

  const pending = inFlightResolutions.get(normalized);
  if (pending) {
    return pending;
  }

  const task = (async () => {
    const match = normalized.match(MEDIA_URI_REGEX);
    if (!match) {
      throw new Error('无效的云端图片引用格式。');
    }

    const mediaId = match[1];
    const totalChunks = Number(match[2]);
    const cacheKeyUrl = `https://bethel-media.local/${mediaId}/${totalChunks}`;

    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await window.caches.open(CACHE_NAME);
        const cachedResp = await cache.match(cacheKeyUrl);
        if (cachedResp) {
          const blob = await cachedResp.blob();
          const objectUrl = URL.createObjectURL(blob);
          resolvedObjectUrls.set(normalized, objectUrl);
          return objectUrl;
        }
      } catch {
        // Fallback to REST fetch
      }
    }

    const earlyParts = await consumeEarlyHeroMediaChunks(normalized);
    const fullDataUrl =
      earlyParts && earlyParts.length === totalChunks
        ? earlyParts.join('')
        : await fetchLegacyMediaDataUrlViaRest(normalized);

    const blob = await dataUrlToBlobFast(fullDataUrl);
    return putBlobInBrowserCache(normalized, blob);
  })();

  inFlightResolutions.set(normalized, task);
  try {
    return await task;
  } finally {
    inFlightResolutions.delete(normalized);
  }
}

export function preloadImageRef(src: string | undefined, priority: 'high' | 'low' = 'low'): void {
  if (typeof window === 'undefined') return;
  const trimmed = String(src ?? '').trim();
  if (!trimmed) return;

  if (isMediaUri(trimmed)) {
    void resolveMediaUri(trimmed).catch(() => {
      // Handled gracefully when SafeImage renders
    });
    return;
  }

  if (SAFE_HTTP_OR_ROOT_RELATIVE_REGEX.test(trimmed) && !preloadedExternalUrls.has(trimmed)) {
    preloadedExternalUrls.add(trimmed);
    if (priority === 'high' && typeof document !== 'undefined' && document.head) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = trimmed;
      link.setAttribute('fetchpriority', 'high');
      document.head.appendChild(link);
    } else {
      const img = new Image();
      img.decoding = 'async';
      img.src = trimmed;
    }
  }
}

export async function uploadBlobToD1Media(
  blob: Blob,
  getToken: () => Promise<string | null>
): Promise<string> {
  const token = await getToken();
  if (!token) {
    throw new Error('登录凭证已失效，请重新登录后再上传图片。');
  }
  const contentType = blob.type || 'image/webp';
  const res = await fetch('/api/media/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
    },
    body: blob,
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    url?: string;
    error?: string;
  };
  if (!res.ok || !data.ok || !data.url) {
    throw new Error(data.error || `图片上传到 Cloudflare D1 失败（HTTP ${res.status}）。`);
  }
  return data.url;
}

export async function persistImageToD1IfNeeded(
  imageRef: string | undefined,
  getToken: () => Promise<string | null>
): Promise<string> {
  const trimmed = String(imageRef ?? '').trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  if (!DATA_IMAGE_URI_REGEX.test(trimmed)) {
    throw new Error('图片格式不受支持，请上传 JPG、PNG 或 WebP 格式图片。');
  }
  const blob = await dataUrlToBlobFast(trimmed);
  return await uploadBlobToD1Media(blob, getToken);
}
