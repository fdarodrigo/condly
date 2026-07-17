import { LayoutDashboard } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RequireRole } from '@/components/layout/require-role';
import { DashboardRouter } from './dashboard-router';

export default function DashboardPage() {
  return (
    <RequireRole roles={['SINDICO', 'ADMINISTRADORA']}>
      <PageHeader
        icone={LayoutDashboard}
        titulo="Dashboard"
        descricao="Visão geral do condomínio ou da carteira, conforme seu papel."
      />
      <DashboardRouter />
    </RequireRole>
  );
}
