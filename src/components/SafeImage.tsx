import { useState } from 'react';
import { Church } from 'lucide-react';
import { DATA_IMAGE_URI_REGEX } from '../lib/mediaStorage';
import { SAFE_HTTP_OR_ROOT_RELATIVE_REGEX } from '../utils/urlSafety';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  priority?: boolean;
  defer?: boolean;
  fitMode?: 'cover' | 'contain' | 'auto-contain-portrait';
}

function isSafeDirectImageSrc(src: string): boolean {
  const trimmed = String(src ?? '').trim();
  if (!trimmed) return false;
  return SAFE_HTTP_OR_ROOT_RELATIVE_REGEX.test(trimmed) || DATA_IMAGE_URI_REGEX.test(trimmed);
}

export function SafeImage({
  src,
  alt,
  className = '',
  fallbackLabel,
  priority = false,
  defer = false,
  fitMode,
}: SafeImageProps) {
  const trimmed = defer ? '' : String(src ?? '').trim();
  const effectiveSrc = isSafeDirectImageSrc(trimmed) ? trimmed : '';

  const [hasError, setHasError] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);

  if (defer) {
    return (
      <div
        aria-label={alt}
        className={`bg-[var(--theme-ink)]/10 ${className}`}
      />
    );
  }

  if (hasError || !effectiveSrc) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-[var(--theme-surface-alt)] text-[var(--theme-ink-muted)] p-6 text-center ${className}`}
      >
        <Church className="w-8 h-8 mb-2 text-[var(--theme-accent)]/60" strokeWidth={1.5} />
        <span className="text-xs font-medium tracking-wide text-[var(--theme-ink-muted)]">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  const resolvedFitClass =
    fitMode === 'contain' || (fitMode === 'auto-contain-portrait' && isPortrait)
      ? 'object-contain object-center'
      : fitMode
      ? 'object-cover object-center'
      : '';

  const imgClassName = resolvedFitClass
    ? `${resolvedFitClass} ${className}`
    : className;

  const updateOrientation = (img: HTMLImageElement | null) => {
    if (!img || !img.naturalWidth || !img.naturalHeight) return;
    setIsPortrait(img.naturalHeight > img.naturalWidth);
  };

  return (
    <img
      ref={(node) => {
        if (node?.complete) {
          updateOrientation(node);
        }
      }}
      src={effectiveSrc}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'low'}
      referrerPolicy="no-referrer"
      onLoad={(e) => updateOrientation(e.currentTarget)}
      onError={() => setHasError(true)}
      className={imgClassName}
    />
  );
}
