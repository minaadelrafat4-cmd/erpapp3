import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ children, className, hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return <div className={cn('glass-card p-6', hover && 'card-hover', className)}>{children}</div>;
}

type BadgeColor = 'gold' | 'accent' | 'error' | 'warning' | 'neutral' | 'success';
const badgeColors: Record<BadgeColor, string> = {
  gold: 'bg-gold-500/15 text-gold-300 border border-gold-500/30',
  accent: 'bg-accent-500/15 text-accent-300 border border-accent-500/30',
  error: 'bg-error-500/15 text-error-400 border border-error-500/30',
  warning: 'bg-warning-500/15 text-warning-400 border border-warning-500/30',
  neutral: 'bg-white/10 text-ink-200 border border-white/10',
  success: 'bg-success-500/15 text-success-400 border border-success-500/30',
};

export function Badge({ children, color = 'neutral', className }: { children: ReactNode; color?: BadgeColor; className?: string }) {
  return <span className={cn('chip', badgeColors[color], className)}>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('animate-spin rounded-full border-2 border-white/10 border-t-gold-400', className ?? 'w-6 h-6')} role="status" aria-label="Loading" />
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      {icon && <div className="mb-4 text-ink-400">{icon}</div>}
      <h3 className="text-lg font-semibold text-ink-100">{title}</h3>
      {description && <p className="mt-1 text-sm text-ink-400 max-w-sm">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, subtitle, center }: { eyebrow?: string; title: string; subtitle?: string; center?: boolean }) {
  return (
    <div className={cn('mb-8', center && 'text-center')}>
      {eyebrow && <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-2">{eyebrow}</p>}
      <h2 className="text-3xl md:text-4xl font-semibold text-ink-50 text-balance">{title}</h2>
      {subtitle && <p className={cn('mt-3 text-ink-300 max-w-2xl', center && 'mx-auto')}>{subtitle}</p>}
    </div>
  );
}
