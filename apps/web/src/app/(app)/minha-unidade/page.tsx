import { RequireRole } from '@/components/layout/require-role';
import { MinhaUnidadeContent } from './minha-unidade-content';

export default function MinhaUnidadePage() {
  return (
    <RequireRole roles={['CONDOMINO']}>
      <h1 className="mb-6 text-xl font-semibold">Minha unidade</h1>
      <MinhaUnidadeContent />
    </RequireRole>
  );
}
