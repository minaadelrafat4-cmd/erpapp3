import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StarRating({ value, size = 16, className }: { value: number; size?: number; className?: string }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <div className={cn('flex items-center gap-0.5', className)} aria-label={`${value.toFixed(1)} out of 5 stars`}>
      <svg width="0" height="0" aria-hidden="true">
        <defs>
          <linearGradient id="half" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < full;
        const isHalf = i === full && half;
        return (
          <Star
            key={i}
            width={size}
            height={size}
            className={cn(filled || isHalf ? 'text-gold-400' : 'text-ink-600')}
            fill={filled ? 'currentColor' : isHalf ? 'url(#half)' : 'none'}
            strokeWidth={1.5}
          />
        );
      })}
    </div>
  );
}
