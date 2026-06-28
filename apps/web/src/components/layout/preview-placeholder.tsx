import type { LucideIcon } from 'lucide-react';
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
 * formulário: só o selo "Em breve" deixa claro que é uma prévia, nunca
 * algo que pareça quebrado durante uma demonstração.
 */
export function PreviewPlaceholder({ icone: Icone, titulo, descricao }: PreviewPlaceholderProps) {
  return (
    <Card className="max-w-lg" data-testid="preview-placeholder">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Icone className="size-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <p className="text-sm text-muted-foreground">{descricao}</p>
        </div>
        <Badge variant="outline" data-testid="preview-em-breve">
          Em breve
        </Badge>
      </CardContent>
    </Card>
  );
}
