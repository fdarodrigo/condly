'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MessageSquare,
  PieChart,
  ShieldAlert,
  User,
  Wallet,
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
  { href: '/chamados', label: 'Chamados', testId: 'chamados', icone: MessageSquare },
  { href: '/reservas', label: 'Reservas', testId: 'reservas', icone: CalendarDays },
  { href: '/documentos', label: 'Documentos', testId: 'documentos', icone: FileText },
  { href: '/avisos', label: 'Avisos', testId: 'avisos', icone: Bell },
  { href: '/advertencias', label: 'Advertências', testId: 'advertencias', icone: ShieldAlert },
  { href: '/enquetes', label: 'Enquetes', testId: 'enquetes', icone: PieChart },
  { href: '/assembleias', label: 'Assembleias', testId: 'assembleias', icone: Building2 },
];

// Visível só pra ADMINISTRADORA — nem SINDICO de um dos condomínios da
// carteira acessa essa visão agregada (CLAUDE.md, decisões do dashboard).
const ITEM_CARTEIRA_ADM: ItemNavegacao = {
  href: '/administradora/dashboard',
  label: 'Carteira',
  testId: 'carteira',
  icone: Briefcase,
};

// Visível só pra SINDICO — visão financeira e operacional do condomínio.
const ITEM_CARTEIRA_SINDICO: ItemNavegacao = {
  href: '/carteira',
  label: 'Carteira',
  testId: 'carteira-sindico',
  icone: Wallet,
};

// Visível pra ADMINISTRADORA e SINDICO — alertas operacionais.
const ITEM_ALERTAS: ItemNavegacao = {
  href: '/alertas',
  label: 'Alertas',
  testId: 'alertas',
  icone: AlertTriangle,
};

// Visível só pra ADMINISTRADORA e SINDICO — CONDOMINO não gerencia serviços.
const ITEM_ACOES: ItemNavegacao = {
  href: '/acoes-administrativas',
  label: 'Ações Administrativas',
  testId: 'acoes-administrativas',
  icone: ClipboardList,
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

function RotuloGrupo({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-3 text-[0.625rem] font-semibold tracking-[0.12em] text-muted-foreground/70 uppercase">
      {children}
    </span>
  );
}

function ItemLink({
  item,
  ativo,
  onClick,
}: {
  item: ItemNavegacao;
  ativo: boolean;
  onClick?: () => void;
}) {
  const Icone = item.icone;
  return (
    <Link
      href={item.href}
      data-testid={`nav-${item.testId}`}
      aria-current={ativo ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        ativo && 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--brand)]',
      )}
    >
      <Icone
        className={cn(
          'size-[18px] shrink-0 transition-colors group-hover:text-primary',
          ativo && 'text-primary',
        )}
        aria-hidden="true"
      />
      <span className="leading-snug">{item.label}</span>
    </Link>
  );
}

/**
 * Conteúdo dos grupos de navegação (itens + filtro por papel), compartilhado
 * entre a Sidebar de desktop e o drawer mobile (MobileNav) — os dois sempre
 * mostram exatamente os mesmos itens. `aoNavegar` é chamado ao clicar em
 * qualquer item (o drawer usa pra se fechar; a sidebar não passa nada).
 */
export function ConteudoNavegacao({ aoNavegar }: { aoNavegar?: () => void }) {
  const pathname = usePathname();
  const [ehAdministradora, setEhAdministradora] = useState(false);
  const [ehSindico, setEhSindico] = useState(false);
  const [ehGestor, setEhGestor] = useState(false);

  useEffect(() => {
    const vinculos = obterVinculos();
    setEhAdministradora(temPapel(vinculos, ['ADMINISTRADORA']));
    setEhSindico(temPapel(vinculos, ['SINDICO']));
    setEhGestor(temPapel(vinculos, ['ADMINISTRADORA', 'SINDICO']));
  }, []);

  return (
    <>
      <div className="flex flex-col gap-1">
        <RotuloGrupo>Principal</RotuloGrupo>
        <ul className="flex flex-col gap-0.5">
          {GRUPO_PRINCIPAL.map((item) => (
            <li key={item.href}>
              <ItemLink
                item={item}
                ativo={Boolean(pathname?.startsWith(item.href))}
                onClick={aoNavegar}
              />
            </li>
          ))}
          {/* Alertas — visão de situações críticas: só ADMINISTRADORA e SINDICO. */}
          {ehGestor && (
            <li key={ITEM_ALERTAS.href}>
              <ItemLink
                item={ITEM_ALERTAS}
                ativo={Boolean(pathname?.startsWith(ITEM_ALERTAS.href))}
                onClick={aoNavegar}
              />
            </li>
          )}
          {/* Carteira da ADMINISTRADORA — portfólio da carteira de condomínios. */}
          {ehAdministradora && (
            <li key={ITEM_CARTEIRA_ADM.href}>
              <ItemLink
                item={ITEM_CARTEIRA_ADM}
                ativo={Boolean(pathname?.startsWith(ITEM_CARTEIRA_ADM.href))}
                onClick={aoNavegar}
              />
            </li>
          )}
          {/* Carteira do SINDICO — visão financeira e operacional do condomínio. */}
          {ehSindico && (
            <li key={ITEM_CARTEIRA_SINDICO.href}>
              <ItemLink
                item={ITEM_CARTEIRA_SINDICO}
                ativo={Boolean(pathname?.startsWith(ITEM_CARTEIRA_SINDICO.href))}
                onClick={aoNavegar}
              />
            </li>
          )}
          {/* Ações Administrativas — só ADMINISTRADORA e SINDICO gerenciam serviços. */}
          {ehGestor && (
            <li key={ITEM_ACOES.href}>
              <ItemLink
                item={ITEM_ACOES}
                ativo={Boolean(pathname?.startsWith(ITEM_ACOES.href))}
                onClick={aoNavegar}
              />
            </li>
          )}
        </ul>
      </div>

      <div className="flex flex-col gap-1">
        <RotuloGrupo>Em breve</RotuloGrupo>
        <ul className="flex flex-col gap-0.5">
          {GRUPO_VITRINE.map((item) => (
            <li key={item.href}>
              <ItemLink
                item={item}
                ativo={Boolean(pathname?.startsWith(item.href))}
                onClick={aoNavegar}
              />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <nav
      aria-label="Navegação principal"
      className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex"
    >
      <div className="flex h-17 items-center border-b border-sidebar-border px-4">
        <Wordmark />
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-3 pt-5">
        <ConteudoNavegacao />
      </div>
    </nav>
  );
}
