import { useEffect, useRef, useState } from 'react';
import { Church } from 'lucide-react';
import {
  DATA_IMAGE_URI_REGEX,
  getCachedMediaObjectUrl,
  isMediaUri,
  resolveMediaUri,
} from '../lib/mediaStorage';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  priority?: boolean;
  defer?: boolean;
}

function isSafeDirectImageSrc(src: string): boolean {
  const trimmed = String(src ?? '').trim();
  if (!trimmed) return false;
  return /^(https?:\/\/|\/).+$/.test(trimmed) || DATA_IMAGE_URI_REGEX.test(trimmed);
}

export function SafeImage({
  src,
  alt,
  className = '',
  fallbackLabel,
  priority = false,
  defer = false,
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
    return <div ref={containerRef} aria-label={alt} className={`bg-[#1C1917]/10 ${className}`} />;
  }

  const effectiveSrc = mediaRef ? resolvedMediaUrl : directSrc;

  if (mediaRef && !effectiveSrc && !hasError) {
    return (
      <div
        ref={containerRef}
        aria-label={alt}
        className={`bg-[#1C1917]/15 animate-pulse ${className}`}
      />
    );
  }

  if (hasError || !effectiveSrc) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-[#EFEAE0] text-[#57534E] p-6 text-center ${className}`}
      >
        <Church className="w-8 h-8 mb-2 text-[#1E3A5F]/60" strokeWidth={1.5} />
        <span className="text-xs font-medium tracking-wide text-[#57534E]">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'low'}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
