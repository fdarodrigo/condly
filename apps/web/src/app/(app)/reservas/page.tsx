import { CalendarDays } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RequireRole } from '@/components/layout/require-role';
import { ReservasContent } from './reservas-content';

export default function ReservasPage() {
  return (
    <RequireRole roles={['CONDOMINO']}>
      <PageHeader
        icone={CalendarDays}
        titulo="Reservas"
        descricao="Escolha uma área comum e um horário disponível."
      />
      <ReservasContent />
    </RequireRole>
  );
}
