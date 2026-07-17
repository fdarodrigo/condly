import { BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RequireRole } from '@/components/layout/require-role';
import { RelatoriosContent } from './relatorios-content';

export default function RelatoriosPage() {
  return (
    <RequireRole roles={['ADMINISTRADORA', 'SINDICO']}>
      <PageHeader
        icone={BarChart3}
        titulo="Relatórios"
        descricao="Analise métricas financeiras e operacionais por condomínio ou por unidade."
      />
      <RelatoriosContent />
    </RequireRole>
  );
}
