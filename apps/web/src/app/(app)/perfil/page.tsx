import { User } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RequireRole } from '@/components/layout/require-role';
import { PerfilContent } from './perfil-content';

export default function PerfilPage() {
  return (
    <RequireRole roles={['ADMINISTRADORA', 'SINDICO']}>
      <PageHeader
        icone={User}
        titulo="Perfil & Gestão"
        descricao="Gerencie condomínios, síndicos, condôminos e permissões."
      />
      <PerfilContent />
    </RequireRole>
  );
}
