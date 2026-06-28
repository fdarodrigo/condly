import { LayoutDashboard } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RequireRole } from '@/components/layout/require-role';
import { DashboardContent } from './dashboard-content';

export default function DashboardPage() {
  return (
    <RequireRole roles={['ADMINISTRADORA', 'SINDICO']}>
      <PageHeader
        icone={LayoutDashboard}
        titulo="Dashboard do condomínio"
        descricao="Financeiro do mês e chamados em andamento."
      />
      <DashboardContent />
    </RequireRole>
  );
}
