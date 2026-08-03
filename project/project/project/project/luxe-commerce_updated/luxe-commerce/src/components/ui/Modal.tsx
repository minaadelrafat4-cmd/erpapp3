import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnBackdrop?: boolean;
}

const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function Modal({ open, onClose, children, title, size = 'md', closeOnBackdrop = true }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm animate-fade-in" onClick={() => closeOnBackdrop && onClose()} />
      <div className={cn('relative glass-card w-full p-6 animate-scale-in', sizes[size])} role="dialog" aria-modal="true">
        {title && <h2 className="text-xl font-semibold mb-4 text-ink-50">{title}</h2>}
        <button onClick={onClose} className="absolute top-4 right-4 text-ink-400 hover:text-ink-100 transition" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
