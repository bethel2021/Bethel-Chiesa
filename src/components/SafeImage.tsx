import { useEffect, useRef, useState } from 'react';
import { Church } from 'lucide-react';
import {
  DATA_IMAGE_URI_REGEX,
  getCachedMediaObjectUrl,
  isMediaUri,
  resolveMediaUri,
} from '../lib/mediaStorage';
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
  const mediaRef = isMediaUri(trimmed) ? trimmed : '';
  const directSrc = !mediaRef && isSafeDirectImageSrc(trimmed) ? trimmed : '';

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(priority);
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string>(() =>
    mediaRef ? getCachedMediaObjectUrl(mediaRef) || '' : ''
  );
  const [hasError, setHasError] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    if (priority || inView) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '450px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [priority, inView, defer]);

  useEffect(() => {
    setHasError(false);
    setIsPortrait(false);

    if (!mediaRef) {
      setResolvedMediaUrl('');
      return;
    }

    const cached = getCachedMediaObjectUrl(mediaRef);
    if (cached) {
      setResolvedMediaUrl(cached);
      return;
    }

    if (!priority && !inView) {
      return;
    }

    let cancelled = false;
    setResolvedMediaUrl('');

    resolveMediaUri(mediaRef)
      .then((objectUrl) => {
        if (!cancelled) {
          setResolvedMediaUrl(objectUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mediaRef, directSrc, priority, inView]);

  if (defer) {
    return (
      <div
        ref={containerRef}
        aria-label={alt}
        className={`bg-[var(--theme-ink)]/10 ${className}`}
      />
    );
  }

  const effectiveSrc = mediaRef ? resolvedMediaUrl : directSrc;

  if (mediaRef && !effectiveSrc && !hasError) {
    return (
      <div
        ref={containerRef}
        aria-label={alt}
        className={`bg-[var(--theme-ink)]/15 animate-pulse ${className}`}
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
