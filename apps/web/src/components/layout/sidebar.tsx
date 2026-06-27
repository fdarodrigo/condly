'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// Avisos e Documentos ainda não têm página própria (chegam no Prompt
// 10.6) — o link já fica aqui de propósito, apontando pra uma rota que
// ainda não existe (404 até lá).
const ITENS_NAVEGACAO = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/reservas', label: 'Reservas' },
  { href: '/documentos', label: 'Documentos' },
  { href: '/avisos', label: 'Avisos' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="hidden w-56 shrink-0 border-r border-border bg-white p-4 md:block"
    >
      <ul className="flex flex-col gap-1">
        {ITENS_NAVEGACAO.map((item) => {
          const ativo = pathname?.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                data-testid={`nav-${item.label.toLowerCase()}`}
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
