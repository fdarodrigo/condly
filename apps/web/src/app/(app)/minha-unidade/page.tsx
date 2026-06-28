import { Home } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RequireRole } from '@/components/layout/require-role';
import { MinhaUnidadeContent } from './minha-unidade-content';

export default function MinhaUnidadePage() {
  return (
    <RequireRole roles={['CONDOMINO']}>
      <PageHeader icone={Home} titulo="Minha unidade" descricao="Seu saldo e próximas reservas." />
      <MinhaUnidadeContent />
    </RequireRole>
  );
}
