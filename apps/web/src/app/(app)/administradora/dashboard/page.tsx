import { RequireRole } from '@/components/layout/require-role';
import { AdministradoraDashboardContent } from './administradora-dashboard-content';

export default function AdministradoraDashboardPage() {
  return (
    <RequireRole roles={['ADMINISTRADORA']}>
      <h1 className="mb-6 text-xl font-semibold">Dashboard da administradora</h1>
      <AdministradoraDashboardContent />
    </RequireRole>
  );
}
