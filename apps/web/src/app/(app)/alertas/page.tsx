import { RequireRole } from '@/components/layout/require-role';
import { PageHeader } from '@/components/layout/page-header';
import { AlertTriangle } from 'lucide-react';
import { AlertasContent } from './alertas-content';

export default function AlertasPage() {
  return (
    <RequireRole roles={['SINDICO', 'ADMINISTRADORA']}>
      <div className="flex flex-col gap-6">
        <PageHeader
          icone={AlertTriangle}
          titulo="Alertas"
          descricao="Situações que precisam da sua atenção"
        />
        <AlertasContent />
      </div>
    </RequireRole>
  );
}
