'use client';

import { useRouter } from 'next/navigation';
import { Wordmark } from './wordmark';
import { Button } from '@/components/ui/button';
import { limparAccessToken } from '@/lib/auth';

export function Topbar() {
  const router = useRouter();

  function sair() {
    limparAccessToken();
    router.replace('/login');
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-white px-4">
      <Wordmark />
      <Button variant="outline" size="sm" onClick={sair} data-testid="botao-sair">
        Sair
      </Button>
    </header>
  );
}
