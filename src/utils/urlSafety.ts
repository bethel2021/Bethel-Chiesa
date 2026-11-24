export const MEDIA_URI_REGEX = /^media:\/\/([a-zA-Z0-9_-]+)\/([1-9][0-9]?)$/;
export const DATA_IMAGE_URI_REGEX = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;
export const YOUTUBE_HTTPS_URL_REGEX =
  /^https:\/\/([a-zA-Z0-9-]+\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\/.+$/;
export const SAFE_HTTP_OR_ROOT_RELATIVE_REGEX = /^(https?:\/\/.+|\/(?!\/).*)$/;

export function isSafeImageSrc(src: unknown): src is string {
  if (typeof src !== 'string') return false;
  const trimmed = src.trim();
  if (!trimmed) return false;
  return (
    SAFE_HTTP_OR_ROOT_RELATIVE_REGEX.test(trimmed) ||
    MEDIA_URI_REGEX.test(trimmed) ||
    DATA_IMAGE_URI_REGEX.test(trimmed)
  );
}

export function filterSafeImageSrc(src: unknown, fallback = ''): string {
  return isSafeImageSrc(src) ? src.trim() : fallback;
}

export function isSafeYoutubeUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  return trimmed.length > 0 && trimmed.length <= 500 && YOUTUBE_HTTPS_URL_REGEX.test(trimmed);
}

export function filterSafeYoutubeUrl(url: unknown): string {
  return isSafeYoutubeUrl(url) ? url.trim() : '';
}
