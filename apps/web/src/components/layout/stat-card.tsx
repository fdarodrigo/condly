import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icone: LucideIcon;
  label: string;
  valor: React.ReactNode;
  descricao?: string;
  tom?: 'default' | 'destructive' | 'success';
  dataTestId?: string;
}

const TOM_CLASSES: Record<NonNullable<StatCardProps['tom']>, string> = {
  default: 'bg-primary/10 text-primary',
  destructive: 'bg-destructive/10 text-destructive',
  success: 'bg-emerald-500/10 text-emerald-400',
};

/** Card de número-chave reusado pelos dois dashboards (condomínio e carteira). */
export function StatCard({
  icone: Icone,
  label,
  valor,
  descricao,
  tom = 'default',
  dataTestId,
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            {label}
          </span>
          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', TOM_CLASSES[tom])}>
            <Icone className="size-4" aria-hidden="true" />
          </span>
        </div>
        <span
          className="font-display text-2xl font-semibold tracking-tight text-foreground"
          data-testid={dataTestId}
        >
          {valor}
        </span>
        {descricao && <span className="text-xs text-muted-foreground">{descricao}</span>}
      </CardContent>
    </Card>
  );
}
