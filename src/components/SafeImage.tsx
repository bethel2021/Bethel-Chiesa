import { useEffect, useState } from 'react';
import { Church } from 'lucide-react';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

function isSafeImageSrc(src: string): boolean {
  const trimmed = String(src ?? '').trim();
  if (!trimmed) return false;
  return (
    /^(https?:\/\/|\/).+$/.test(trimmed) ||
    /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)
  );
}

export function SafeImage({ src, alt, className = '', fallbackLabel }: SafeImageProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const safeSrc = isSafeImageSrc(src) ? src.trim() : '';

  if (hasError || !safeSrc) {
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
      src={safeSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
