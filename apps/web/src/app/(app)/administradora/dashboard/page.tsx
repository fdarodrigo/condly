import { Briefcase } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RequireRole } from '@/components/layout/require-role';
import { AdministradoraDashboardContent } from './administradora-dashboard-content';

export default function AdministradoraDashboardPage() {
  return (
    <RequireRole roles={['ADMINISTRADORA']}>
      <PageHeader
        icone={Briefcase}
        titulo="Carteira"
        descricao="Visão agregada de todos os condomínios administrados."
      />
      <AdministradoraDashboardContent />
    </RequireRole>
  );
}
