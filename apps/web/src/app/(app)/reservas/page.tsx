import { RequireRole } from '@/components/layout/require-role';
import { ReservasContent } from './reservas-content';

export default function ReservasPage() {
  return (
    <RequireRole roles={['CONDOMINO']}>
      <h1 className="mb-6 text-xl font-semibold">Reservas</h1>
      <ReservasContent />
    </RequireRole>
  );
}
