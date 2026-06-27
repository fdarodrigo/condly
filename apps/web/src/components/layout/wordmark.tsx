import { cn } from '@/lib/utils';

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-lg font-semibold tracking-tight text-foreground', className)}>
      Cond<span style={{ color: '#0F6E56' }}>ly</span>
    </span>
  );
}
