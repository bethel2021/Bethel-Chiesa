export const MEDIA_URI_REGEX = /^media:\/\/([a-zA-Z0-9_-]+)\/([1-9][0-9]?)$/;
export const DATA_IMAGE_URI_REGEX = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;
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
