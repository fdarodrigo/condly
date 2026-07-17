import { Building2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RequireRole } from '@/components/layout/require-role';
import { AssembleiasContent } from './assembleias-content';

export default function AssembleiasPage() {
  return (
    <RequireRole roles={['ADMINISTRADORA', 'SINDICO', 'CONDOMINO']}>
      <PageHeader
        icone={Building2}
        titulo="Assembleias"
        descricao="Registro de assembleias, pautas e deliberações tomadas."
      />
      <AssembleiasContent />
    </RequireRole>
  );
}
