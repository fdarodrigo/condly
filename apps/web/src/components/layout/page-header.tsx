import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  titulo: string;
  descricao?: string;
  icone: LucideIcon;
  acao?: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho padrão de cada página autenticada — ícone + título (+
 * descrição opcional) à esquerda, slot de ação opcional à direita.
 * Substitui os `<h1>` soltos que cada página tinha antes, pra dar o
 * mesmo ritmo visual em todas as telas do produto.
 */
export function PageHeader({ titulo, descricao, icone: Icone, acao, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex items-start justify-between gap-4', className)}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icone className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{titulo}</h1>
          {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
        </div>
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}
