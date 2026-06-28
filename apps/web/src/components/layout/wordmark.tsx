import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WordmarkProps {
  className?: string;
  tamanho?: 'sm' | 'lg';
}

export function Wordmark({ className, tamanho = 'sm' }: WordmarkProps) {
  const grande = tamanho === 'lg';

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm',
          grande ? 'size-10' : 'size-7',
        )}
      >
        <Building2 className={grande ? 'size-5' : 'size-4'} aria-hidden="true" />
      </span>
      <span
        className={cn(
          'font-semibold tracking-tight text-foreground',
          grande ? 'text-2xl' : 'text-lg',
        )}
      >
        Cond<span className="text-primary">ly</span>
      </span>
    </span>
  );
}
