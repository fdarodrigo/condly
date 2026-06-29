import { Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WordmarkProps {
  className?: string;
  tamanho?: 'sm' | 'lg';
}

export function Wordmark({ className, tamanho = 'sm' }: WordmarkProps) {
  const grande = tamanho === 'lg';

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-strong text-brand-foreground shadow-[0_6px_16px_-4px_rgba(31,179,137,0.5)]',
          grande ? 'size-10' : 'size-8',
        )}
      >
        <Home className={grande ? 'size-5' : 'size-4'} strokeWidth={2.4} aria-hidden="true" />
      </span>
      <span
        className={cn(
          'font-display font-bold tracking-tight text-foreground',
          grande ? 'text-2xl' : 'text-lg',
        )}
      >
        Condly
      </span>
    </span>
  );
}
