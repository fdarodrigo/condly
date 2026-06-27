import { RequireRole } from '@/components/layout/require-role';
import { DashboardContent } from './dashboard-content';

export default function DashboardPage() {
  return (
    <RequireRole roles={['ADMINISTRADORA', 'SINDICO']}>
      <h1 className="mb-6 text-xl font-semibold">Dashboard do condomínio</h1>
      <DashboardContent />
    </RequireRole>
  );
}
