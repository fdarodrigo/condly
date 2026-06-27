import { RequireRole } from '@/components/layout/require-role';
import { AvisosContent } from './avisos-content';

export default function AvisosPage() {
  return (
    <RequireRole roles={['ADMINISTRADORA', 'SINDICO', 'CONDOMINO']}>
      <h1 className="mb-6 text-xl font-semibold">Avisos</h1>
      <AvisosContent />
    </RequireRole>
  );
}
