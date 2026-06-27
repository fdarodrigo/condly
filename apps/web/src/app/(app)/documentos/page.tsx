import { RequireRole } from '@/components/layout/require-role';
import { DocumentosContent } from './documentos-content';

export default function DocumentosPage() {
  return (
    <RequireRole roles={['ADMINISTRADORA', 'SINDICO', 'CONDOMINO']}>
      <h1 className="mb-6 text-xl font-semibold">Documentos</h1>
      <DocumentosContent />
    </RequireRole>
  );
}
