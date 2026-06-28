'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { obterVinculos, temPapel } from '@/lib/auth';

const ITENS_NAVEGACAO = [
  { href: '/dashboard', label: 'Dashboard', testId: 'dashboard' },
  { href: '/reservas', label: 'Reservas', testId: 'reservas' },
  { href: '/documentos', label: 'Documentos', testId: 'documentos' },
  { href: '/avisos', label: 'Avisos', testId: 'avisos' },
  // Telas de vitrine (Prompt 10.7): sem chamada de API, só pra mostrar a
  // amplitude do produto numa demonstração — ver PreviewPlaceholder.
  { href: '/perfil', label: 'Perfil', testId: 'perfil' },
  {
    href: '/bot-whatsapp',
    label: 'Configurações do bot no WhatsApp',
    testId: 'bot-whatsapp',
  },
  { href: '/relatorios', label: 'Relatórios', testId: 'relatorios' },
];

// Visível só pra ADMINISTRADORA — nem SINDICO de um dos condomínios da
// carteira acessa essa visão agregada (CLAUDE.md, decisões do dashboard).
const ITEM_DASHBOARD_ADMINISTRADORA = {
  href: '/administradora/dashboard',
  label: 'Carteira',
  testId: 'carteira',
};

export function Sidebar() {
  const pathname = usePathname();
  const [ehAdministradora, setEhAdministradora] = useState(false);

  useEffect(() => {
    setEhAdministradora(temPapel(obterVinculos(), ['ADMINISTRADORA']));
  }, []);

  const itens = ehAdministradora ? [...ITENS_NAVEGACAO, ITEM_DASHBOARD_ADMINISTRADORA] : ITENS_NAVEGACAO;

  return (
    <nav
      aria-label="Navegação principal"
      className="hidden w-56 shrink-0 border-r border-border bg-white p-4 md:block"
    >
      <ul className="flex flex-col gap-1">
        {itens.map((item) => {
          const ativo = pathname?.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                data-testid={`nav-${item.testId}`}
                className={cn(
                  'block rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted',
                  ativo && 'bg-muted text-foreground',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
