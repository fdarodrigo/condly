'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConteudoNavegacao } from './sidebar';
import { Wordmark } from './wordmark';

/**
 * Navegação em drawer pra telas < md, onde a Sidebar fica oculta — sem isso,
 * o mobile não tinha NENHUM acesso às outras telas. O botão hambúrguer vive
 * na Topbar (via este componente); o painel reusa o mesmo ConteudoNavegacao
 * da Sidebar, então os itens (e o filtro por papel) nunca divergem entre
 * desktop e mobile.
 */
export function MobileNav() {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  // Fecha ao trocar de rota — cobre navegação por link do próprio drawer e
  // qualquer navegação programática que aconteça com ele aberto.
  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberto(false);
    };
    document.addEventListener('keydown', aoTeclar);
    // Trava o scroll do conteúdo atrás do drawer enquanto ele está aberto
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.documentElement.style.overflow = '';
    };
  }, [aberto]);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Abrir menu de navegação"
        aria-expanded={aberto}
        onClick={() => setAberto(true)}
        data-testid="botao-menu-mobile"
      >
        <Menu className="size-5" aria-hidden="true" />
      </Button>

      {/* Portal pro body: o backdrop-blur da Topbar cria um containing block,
          então um `fixed` renderizado dentro dela ficaria confinado à altura
          do header em vez de cobrir a viewport inteira. */}
      {aberto &&
        createPortal(
          <div role="dialog" aria-modal="true" aria-label="Navegação principal" className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setAberto(false)}
            data-testid="menu-mobile-backdrop"
          />
          <nav className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar shadow-xl">
            <div className="flex h-17 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
              <Wordmark />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fechar menu de navegação"
                onClick={() => setAberto(false)}
                data-testid="botao-fechar-menu-mobile"
              >
                <X className="size-5" aria-hidden="true" />
              </Button>
            </div>
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-3 pt-5">
              <ConteudoNavegacao aoNavegar={() => setAberto(false)} />
            </div>
          </nav>
          </div>,
          document.body,
        )}
    </div>
  );
}
