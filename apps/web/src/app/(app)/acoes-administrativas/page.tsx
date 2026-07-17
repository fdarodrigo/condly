import { ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RequireRole } from '@/components/layout/require-role';
import { AcoesContent } from './acoes-content';

export default function AcoesAdministrativasPage() {
  return (
    <RequireRole roles={['ADMINISTRADORA', 'SINDICO']}>
      <PageHeader
        icone={ClipboardList}
        titulo="Ações Administrativas"
        descricao="Registro de serviços realizados e controle de validades."
      />
      <AcoesContent />
    </RequireRole>
  );
}
