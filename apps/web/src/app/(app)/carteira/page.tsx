import { RequireRole } from '@/components/layout/require-role';
import { PageHeader } from '@/components/layout/page-header';
import { Wallet } from 'lucide-react';
import { CarteiraSindicoContent } from './carteira-sindico-content';

export default function CarteiraPage() {
  return (
    <RequireRole roles={['SINDICO']}>
      <div className="flex flex-col gap-6">
        <PageHeader
          icone={Wallet}
          titulo="Carteira"
          descricao="Visão financeira e operacional do seu condomínio"
        />
        <CarteiraSindicoContent />
      </div>
    </RequireRole>
  );
}
