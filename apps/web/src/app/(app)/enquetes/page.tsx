import { BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RequireRole } from '@/components/layout/require-role';
import { EnquetesContent } from './enquetes-content';

export default function EnquetesPage() {
  return (
    <RequireRole roles={['ADMINISTRADORA', 'SINDICO', 'CONDOMINO']}>
      <PageHeader
        icone={BarChart3}
        titulo="Enquetes"
        descricao="Pesquisas de satisfação com a gestão e com os serviços do condomínio."
      />
      <EnquetesContent />
    </RequireRole>
  );
}
