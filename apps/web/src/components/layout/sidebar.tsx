'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bell,
  Bot,
  Briefcase,
  CalendarDays,
  FileText,
  LayoutDashboard,
  User,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { obterVinculos, temPapel } from '@/lib/auth';
import { Wordmark } from './wordmark';

interface ItemNavegacao {
  href: string;
  label: string;
  testId: string;
  icone: LucideIcon;
}

const GRUPO_PRINCIPAL: ItemNavegacao[] = [
  { href: '/dashboard', label: 'Dashboard', testId: 'dashboard', icone: LayoutDashboard },
  { href: '/reservas', label: 'Reservas', testId: 'reservas', icone: CalendarDays },
  { href: '/documentos', label: 'Documentos', testId: 'documentos', icone: FileText },
  { href: '/avisos', label: 'Avisos', testId: 'avisos', icone: Bell },
];

// Visível só pra ADMINISTRADORA — nem SINDICO de um dos condomínios da
// carteira acessa essa visão agregada (CLAUDE.md, decisões do dashboard).
const ITEM_CARTEIRA: ItemNavegacao = {
  href: '/administradora/dashboard',
  label: 'Carteira',
  testId: 'carteira',
  icone: Briefcase,
};

// Telas de vitrine (Prompt 10.7): sem chamada de API, só pra mostrar a
// amplitude do produto numa demonstração — ver PreviewPlaceholder.
const GRUPO_VITRINE: ItemNavegacao[] = [
  { href: '/perfil', label: 'Perfil', testId: 'perfil', icone: User },
  {
    href: '/bot-whatsapp',
    label: 'Configurações do bot no WhatsApp',
    testId: 'bot-whatsapp',
    icone: Bot,
  },
  { href: '/relatorios', label: 'Relatórios', testId: 'relatorios', icone: BarChart3 },
];

function ItemLink({ item, ativo }: { item: ItemNavegacao; ativo: boolean }) {
  const Icone = item.icone;
  return (
    <Link
      href={item.href}
      data-testid={`nav-${item.testId}`}
      aria-current={ativo ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        ativo && 'bg-sidebar-accent text-sidebar-accent-foreground',
      )}
    >
      <span
        className={cn(
          'absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary transition-opacity',
          ativo ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden="true"
      />
      <Icone
        className={cn(
          'size-4 shrink-0 text-foreground/40 transition-colors group-hover:text-primary',
          ativo && 'text-primary',
        )}
        aria-hidden="true"
      />
      <span className="leading-snug">{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [ehAdministradora, setEhAdministradora] = useState(false);

  useEffect(() => {
    setEhAdministradora(temPapel(obterVinculos(), ['ADMINISTRADORA']));
  }, []);

  return (
    <nav
      aria-label="Navegação principal"
      className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex"
    >
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Wordmark />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
        <ul className="flex flex-col gap-0.5">
          {GRUPO_PRINCIPAL.map((item) => (
            <li key={item.href}>
              <ItemLink item={item} ativo={Boolean(pathname?.startsWith(item.href))} />
            </li>
          ))}
          {ehAdministradora && (
            <li key={ITEM_CARTEIRA.href}>
              <ItemLink
                item={ITEM_CARTEIRA}
                ativo={Boolean(pathname?.startsWith(ITEM_CARTEIRA.href))}
              />
            </li>
          )}
        </ul>

        <div className="flex flex-col gap-0.5">
          <span className="px-3 text-[0.6875rem] font-semibold tracking-wider text-muted-foreground/70 uppercase">
            Em breve
          </span>
          <ul className="flex flex-col gap-0.5">
            {GRUPO_VITRINE.map((item) => (
              <li key={item.href}>
                <ItemLink item={item} ativo={Boolean(pathname?.startsWith(item.href))} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
