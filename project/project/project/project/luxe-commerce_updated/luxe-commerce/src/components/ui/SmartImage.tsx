import { useState, type ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SmartImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallback?: string;
  aspect?: string;
  eager?: boolean;
}

export function SmartImage({
  src,
  alt,
  fallback,
  aspect,
  eager = false,
  className,
  ...rest
}: SmartImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const resolvedSrc = errored && fallback ? fallback : src;

  return (
    <div className={cn('relative overflow-hidden bg-ink-800', aspect)} {...(rest.style ? { style: rest.style } : {})}>
      {!loaded && (
        <div className="absolute inset-0 skeleton" aria-hidden="true" />
      )}
      <img
        src={resolvedSrc}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (fallback && !errored) {
            setErrored(true);
          } else {
            setLoaded(true);
          }
        }}
        className={cn(
          'transition-opacity duration-500',
          loaded ? 'opacity-100' : 'opacity-0',
          className,
        )}
        {...rest}
      />
    </div>
  );
}
