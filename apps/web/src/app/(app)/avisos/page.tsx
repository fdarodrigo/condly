import { Bell } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RequireRole } from '@/components/layout/require-role';
import { AvisosContent } from './avisos-content';

export default function AvisosPage() {
  return (
    <RequireRole roles={['ADMINISTRADORA', 'SINDICO', 'CONDOMINO']}>
      <PageHeader icone={Bell} titulo="Avisos" descricao="Comunicados do condomínio." />
      <AvisosContent />
    </RequireRole>
  );
}
