import { BarChart3 } from 'lucide-react';
import { PreviewPlaceholder } from '@/components/layout/preview-placeholder';

export default function RelatoriosPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Relatórios</h1>
      <PreviewPlaceholder
        icone={BarChart3}
        titulo="Relatórios"
        descricao="Acompanhe relatórios financeiros e operacionais detalhados do seu condomínio — disponível em breve."
      />
    </>
  );
}
