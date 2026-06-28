import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icone: LucideIcon;
  label: string;
  valor: React.ReactNode;
  tom?: 'default' | 'destructive' | 'success';
  dataTestId?: string;
}

const TOM_CLASSES: Record<NonNullable<StatCardProps['tom']>, string> = {
  default: 'bg-primary/10 text-primary',
  destructive: 'bg-destructive/10 text-destructive',
  success: 'bg-emerald-500/10 text-emerald-600',
};

/** Card de número-chave reusado pelos dois dashboards (condomínio e carteira). */
export function StatCard({ icone: Icone, label, valor, tom = 'default', dataTestId }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 px-5 py-4">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl',
            TOM_CLASSES[tom],
          )}
        >
          <Icone className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="font-mono text-xl font-semibold tracking-tight text-foreground" data-testid={dataTestId}>
            {valor}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
