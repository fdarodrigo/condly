import { Sparkles, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface PreviewPlaceholderProps {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
}

/**
 * Placeholder de uma funcionalidade ainda não construída — usado pelas
 * entradas de "vitrine" da navegação (Perfil, bot do WhatsApp,
 * Relatórios). Não faz nenhuma chamada de rede e não tem nenhum campo de
 * formulário: a borda tracejada + o selo "Em breve" deixam claro que é
 * uma prévia intencional, nunca uma tela quebrada ou um erro.
 */
export function PreviewPlaceholder({ icone: Icone, titulo, descricao }: PreviewPlaceholderProps) {
  return (
    <Card
      className="max-w-md border-2 border-dashed border-border bg-white/70 shadow-none ring-0"
      data-testid="preview-placeholder"
    >
      <CardContent className="flex flex-col items-center gap-4 px-8 py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icone className="size-7" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">{descricao}</p>
        </div>
        <Badge
          variant="outline"
          className="gap-1 border-primary/30 bg-primary/5 text-primary"
          data-testid="preview-em-breve"
        >
          <Sparkles className="size-3" aria-hidden="true" />
          Em breve
        </Badge>
      </CardContent>
    </Card>
  );
}
