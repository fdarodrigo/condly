import { MessageSquare } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RequireRole } from '@/components/layout/require-role';
import { ChamadosContent } from './chamados-content';

export default function ChamadosPage() {
  return (
    <RequireRole roles={['ADMINISTRADORA', 'SINDICO', 'CONDOMINO']}>
      <PageHeader
        icone={MessageSquare}
        titulo="Chamados"
        descricao="Registre e acompanhe chamados de manutenção e ocorrências."
      />
      <ChamadosContent />
    </RequireRole>
  );
}
