import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

export const MEDIA_URI_REGEX = /^media:\/\/([a-zA-Z0-9_-]+)\/([1-9][0-9]?)$/;
export const DATA_IMAGE_URI_REGEX = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const CHUNK_SIZE_CHARS = 650_000;
const MAX_MEDIA_CHUNKS = 30;
const BATCH_CHUNK_LIMIT = 3;
const CACHE_NAME = 'bethel-church-media-v1';

const resolvedObjectUrls = new Map<string, string>();
const inFlightResolutions = new Map<string, Promise<string>>();
const preloadedExternalUrls = new Set<string>();

export function isMediaUri(src: string): boolean {
  return MEDIA_URI_REGEX.test(src.trim());
}

export function getCachedMediaObjectUrl(mediaUri: string): string | null {
  return resolvedObjectUrls.get(mediaUri.trim()) ?? null;
}

async function dataUrlToBlobFast(dataUrl: string): Promise<Blob> {
  // Prefer browser's native off-thread data-URI decoder to avoid main-thread UI stalls on large photos
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
    try {
      const match = mediaUri.match(MEDIA_URI_REGEX);
      if (match) {
        const cache = await window.caches.open(CACHE_NAME);
        await cache.put(
          `https://bethel-media.local/${match[1]}/${match[2]}`,
          new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } })
        );
      }
    } catch {
      // Ignore Cache API storage quota/private mode failures
    }
  }

  return objectUrl;
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
        // Fallback to Firestore fetch
      }
    }

    const chunkSnaps = await Promise.all(
      Array.from({ length: totalChunks }, (_, idx) =>
        getDoc(doc(db, 'media_chunks', `${mediaId}__${idx}`))
      )
    );

    const parts: string[] = [];
    for (let i = 0; i < totalChunks; i += 1) {
      const snap = chunkSnaps[i];
      if (!snap.exists()) {
        throw new Error('部分云端原图分片缺失。');
      }
      const chunkData = snap.data()?.data;
      if (typeof chunkData !== 'string' || !chunkData) {
        throw new Error('云端原图数据格式无效。');
      }
      parts.push(chunkData);
    }

    const fullDataUrl = parts.join('');
    if (!DATA_IMAGE_URI_REGEX.test(fullDataUrl)) {
      throw new Error('云端原图编码校验失败。');
    }

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

  if (/^(https?:\/\/|\/).+$/.test(trimmed) && !preloadedExternalUrls.has(trimmed)) {
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

export async function persistLosslessImageIfNeeded(
  imageRef: string | undefined,
  inlineMaxChars: number
): Promise<string> {
  const trimmed = String(imageRef ?? '').trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  if (!DATA_IMAGE_URI_REGEX.test(trimmed)) {
    throw new Error('图片格式不受支持，请上传 JPG、PNG 或 WebP 格式原图。');
  }

  if (trimmed.length <= inlineMaxChars) {
    return trimmed;
  }

  const chunks: string[] = [];
  for (let offset = 0; offset < trimmed.length; offset += CHUNK_SIZE_CHARS) {
    chunks.push(trimmed.slice(offset, offset + CHUNK_SIZE_CHARS));
  }

  if (chunks.length > MAX_MEDIA_CHUNKS) {
    throw new Error('原图文件过大（已超过 12 MB 原图直传上限），请适当减小原图体积或改用外链网址。');
  }

  const randomPart = Math.random().toString(36).slice(2, 8);
  const mediaId = `img-${Date.now()}-${randomPart}`;

  for (let start = 0; start < chunks.length; start += BATCH_CHUNK_LIMIT) {
    const batch = writeBatch(db);
    const end = Math.min(start + BATCH_CHUNK_LIMIT, chunks.length);
    for (let i = start; i < end; i += 1) {
      batch.set(doc(db, 'media_chunks', `${mediaId}__${i}`), {
        mediaId,
        chunkIndex: i,
        totalChunks: chunks.length,
        data: chunks[i],
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  const mediaUri = `media://${mediaId}/${chunks.length}`;
  try {
    const blob = await dataUrlToBlobFast(trimmed);
    await putBlobInBrowserCache(mediaUri, blob);
  } catch {
    // Non-fatal: cache warm-up failure will lazily fetch on next render
  }

  return mediaUri;
}
