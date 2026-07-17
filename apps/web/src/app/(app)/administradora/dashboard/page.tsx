import { Briefcase } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RequireRole } from '@/components/layout/require-role';
import { CarteiraContent } from './carteira-content';

export default function AdministradoraDashboardPage() {
  return (
    <RequireRole roles={['ADMINISTRADORA']}>
      <PageHeader
        icone={Briefcase}
        titulo="Carteira"
        descricao="Resumo financeiro de todos os condomínios administrados."
      />
      <CarteiraContent />
    </RequireRole>
  );
}
