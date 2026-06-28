import { FileText } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RequireRole } from '@/components/layout/require-role';
import { DocumentosContent } from './documentos-content';

export default function DocumentosPage() {
  return (
    <RequireRole roles={['ADMINISTRADORA', 'SINDICO', 'CONDOMINO']}>
      <PageHeader
        icone={FileText}
        titulo="Documentos"
        descricao="Atas, prestações de contas e outros arquivos do condomínio."
      />
      <DocumentosContent />
    </RequireRole>
  );
}
