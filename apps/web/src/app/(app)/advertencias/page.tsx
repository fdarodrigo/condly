import { ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RequireRole } from '@/components/layout/require-role';
import { AdvertenciasContent } from './advertencias-content';

export default function AdvertenciasPage() {
  return (
    <RequireRole roles={['ADMINISTRADORA', 'SINDICO', 'CONDOMINO']}>
      <PageHeader
        icone={ShieldAlert}
        titulo="Advertências"
        descricao="Registros formais de infrações emitidos para condôminos."
      />
      <AdvertenciasContent />
    </RequireRole>
  );
}
