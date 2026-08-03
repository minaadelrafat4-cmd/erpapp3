import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="w-full">
        {label && <label htmlFor={inputId} className="label">{label}</label>}
        <input ref={ref} id={inputId} className={cn('input', error && 'border-error-500/60 focus:border-error-500', className)} {...props} />
        {error ? <p className="mt-1 text-xs text-error-500">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
      </div>
    );
  },
);
Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const tid = id ?? props.name;
    return (
      <div className="w-full">
        {label && <label htmlFor={tid} className="label">{label}</label>}
        <textarea ref={ref} id={tid} className={cn('input min-h-[120px] resize-y', className)} {...props} />
        {error && <p className="mt-1 text-xs text-error-500">{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className, id, children, ...props }, ref) => {
    const sid = id ?? props.name;
    return (
      <div className="w-full">
        {label && <label htmlFor={sid} className="label">{label}</label>}
        <select ref={ref} id={sid} className={cn('input appearance-none cursor-pointer', className)} {...props}>
          {children}
        </select>
        {error && <p className="mt-1 text-xs text-error-500">{error}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';
