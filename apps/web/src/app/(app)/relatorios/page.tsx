import { BarChart3 } from 'lucide-react';
import { PreviewPlaceholder } from '@/components/layout/preview-placeholder';

export default function RelatoriosPage() {
  return (
    <div className="flex min-h-[70vh] flex-1 items-center justify-center">
      <PreviewPlaceholder
        icone={BarChart3}
        titulo="Relatórios"
        descricao="Acompanhe relatórios financeiros e operacionais detalhados do seu condomínio — disponível em breve."
      />
    </div>
  );
}
