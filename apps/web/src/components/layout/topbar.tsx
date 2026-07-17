'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, LogOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { limparAccessToken, obterCondominioId, obterVinculos, papelPrincipal } from '@/lib/auth';
import { MobileNav } from './mobile-nav';

// O wordmark mudou pro topo da Sidebar (logo de produto fica junto da
// navegação, não repetido em cada tela) — a topbar agora só mostra
// contexto da sessão: condomínio associado (SINDICO/CONDOMINO), papel do
// usuário logado e o botão de saída.
export function Topbar() {
  const router = useRouter();
  const [papel, setPapel] = useState<string | undefined>();
  const [nomeCondominio, setNomeCondominio] = useState<string | undefined>();

  useEffect(() => {
    const vinculos = obterVinculos();
    setPapel(papelPrincipal(vinculos));

    // ADMINISTRADORA não tem condominioId no vínculo (só administradoraId),
    // então o badge de condomínio aparece só pra SINDICO/CONDOMINO — que é
    // exatamente quem tem UM condomínio associado pra mostrar.
    const condominioId = obterCondominioId(vinculos);
    if (!condominioId) return;
    apiFetch<{ nome: string }>(`/condominios/${condominioId}`)
      .then((condominio) => setNomeCondominio(condominio.nome))
      .catch(() => {
        // Falha aqui é só cosmética (o badge não aparece) — nunca bloqueia a tela.
      });
  }, []);

  function sair() {
    limparAccessToken();
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-10 flex h-17 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-sm md:px-6">
      {/* Hambúrguer + drawer de navegação — só existe abaixo de md, onde a
          Sidebar fica oculta. */}
      <MobileNav />
      {/* min-w-0 no wrapper + no span do nome: o nome do condomínio é o único
          item encolhível (trunca), badge e Sair nunca encolhem. */}
      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
        {nomeCondominio && (
          <span
            className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
            data-testid="topbar-condominio"
          >
            <Building2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{nomeCondominio}</span>
          </span>
        )}
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
      </div>
    </header>
  );
}
