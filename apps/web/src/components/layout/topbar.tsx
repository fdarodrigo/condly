'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { limparAccessToken, obterVinculos, papelPrincipal } from '@/lib/auth';

// O wordmark mudou pro topo da Sidebar (logo de produto fica junto da
// navegação, não repetido em cada tela) — a topbar agora só mostra
// contexto da sessão: papel do usuário logado e o botão de saída.
export function Topbar() {
  const router = useRouter();
  const [papel, setPapel] = useState<string | undefined>();

  useEffect(() => {
    setPapel(papelPrincipal(obterVinculos()));
  }, []);

  function sair() {
    limparAccessToken();
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-10 flex h-17 items-center justify-end gap-3 border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      {papel && (
        <Badge
          variant="outline"
          className="border-primary/25 bg-primary/10 text-primary"
          data-testid="badge-papel"
        >
          {papel}
        </Badge>
      )}
      <Button variant="ghost" size="sm" onClick={sair} data-testid="botao-sair">
        <LogOut className="size-4" aria-hidden="true" />
        Sair
      </Button>
    </header>
  );
}
