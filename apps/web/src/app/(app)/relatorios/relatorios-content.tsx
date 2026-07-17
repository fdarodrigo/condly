'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  CheckSquare2,
  ChevronDown,
  Home,
  Square,
  Tag,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { obterVinculos, temPapel } from '@/lib/auth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ── Tipos — condomínios ───────────────────────────────────────────────────────

type MetricaId =
  | 'receita_mes'
  | 'a_receber'
  | 'em_atraso'
  | 'taxa_arrecadacao'
  | 'chamados_abertos'
  | 'chamados_pendentes'
  | 'chamados_andamento'
  | 'reservas_semana'
  | 'servicos_vencer';

interface MetricaDef {
  id: MetricaId;
  label: string;
  formato: 'moeda' | 'pct' | 'numero';
  grupo: 'financeiro' | 'operacional';
}

const TODAS_METRICAS: MetricaDef[] = [
  { id: 'receita_mes', label: 'Receita do mês', formato: 'moeda', grupo: 'financeiro' },
  { id: 'a_receber', label: 'A receber no mês', formato: 'moeda', grupo: 'financeiro' },
  { id: 'em_atraso', label: 'Em atraso', formato: 'moeda', grupo: 'financeiro' },
  { id: 'taxa_arrecadacao', label: 'Taxa de arrecadação', formato: 'pct', grupo: 'financeiro' },
  { id: 'chamados_abertos', label: 'Chamados abertos', formato: 'numero', grupo: 'operacional' },
  { id: 'chamados_pendentes', label: 'Pendentes de triagem', formato: 'numero', grupo: 'operacional' },
  { id: 'chamados_andamento', label: 'Chamados em andamento', formato: 'numero', grupo: 'operacional' },
  { id: 'reservas_semana', label: 'Reservas (próx. 7 dias)', formato: 'numero', grupo: 'operacional' },
  { id: 'servicos_vencer', label: 'Serviços a vencer (30 dias)', formato: 'numero', grupo: 'operacional' },
];

interface DadosCondominio {
  condominioId: string;
  nome: string;
  receita_mes: number;
  a_receber: number;
  em_atraso: number;
  taxa_arrecadacao: number | null;
  chamados_abertos: number;
  chamados_pendentes: number;
  chamados_andamento: number;
  reservas_semana: number;
  servicos_vencer: number;
}

// ── Tipos — unidades ──────────────────────────────────────────────────────────

type StatusFinanceiro = 'ADIMPLENTE' | 'INADIMPLENTE' | 'SEM_COBRANCA';

interface MetricaUnidade {
  unidadeId: string;
  identificador: string;
  tipo: string;
  responsavelNome: string | null;
  statusFinanceiro: StatusFinanceiro;
  totalEmAtraso: number;
  diasAtraso: number;
  chamadosAbertos: number;
  statusOcupacao: string | null;
  flags: string[];
}

// ── Formatação ────────────────────────────────────────────────────────────────

function fmt(valor: number | null, formato: MetricaDef['formato']): string {
  if (valor === null) return '—';
  if (formato === 'moeda') {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  if (formato === 'pct') {
    return `${(valor * 100).toFixed(1)}%`;
  }
  return String(valor);
}

function corMetrica(valor: number | null, id: MetricaId): string {
  if (valor === null) return 'text-muted-foreground';
  if (id === 'em_atraso' && valor > 0) return 'text-rose-400';
  if (id === 'taxa_arrecadacao') {
    if (valor >= 0.9) return 'text-emerald-400';
    if (valor >= 0.7) return 'text-amber-400';
    return 'text-rose-400';
  }
  return 'text-foreground';
}

const LABEL_STATUS_OCUPACAO: Record<string, string> = {
  PROPRIETARIO: 'Proprietário',
  INQUILINO: 'Inquilino',
  VAZIA: 'Vazia',
};

// ── Busca de dados — condomínios ──────────────────────────────────────────────

interface DashboardCondominio {
  totalArrecadadoNoMes: number;
  totalEmAtraso: number;
  chamadosPorStatus: { PENDENTE_TRIAGEM: number; ABERTO: number; EM_ANDAMENTO: number };
  proximosVencimentosServicos: unknown[];
  reservasProximos7Dias: unknown[];
}

interface FinanceiroResumo {
  totalAReceberNoMes: number;
  totalRecebido: number;
}

async function buscarDadosCondominio(condominioId: string, nome: string): Promise<DadosCondominio> {
  const [dash, fin] = await Promise.all([
    apiFetch<DashboardCondominio>(`/condominios/${condominioId}/dashboard`),
    apiFetch<FinanceiroResumo>(`/condominios/${condominioId}/financeiro/resumo`),
  ]);
  const aReceber = fin.totalAReceberNoMes;
  const recebido = dash.totalArrecadadoNoMes;
  const abertos =
    (dash.chamadosPorStatus.PENDENTE_TRIAGEM ?? 0) +
    (dash.chamadosPorStatus.ABERTO ?? 0) +
    (dash.chamadosPorStatus.EM_ANDAMENTO ?? 0);
  return {
    condominioId,
    nome,
    receita_mes: recebido,
    a_receber: aReceber,
    em_atraso: dash.totalEmAtraso,
    taxa_arrecadacao: aReceber > 0 ? Math.round((recebido / aReceber) * 1000) / 1000 : null,
    chamados_abertos: abertos,
    chamados_pendentes: dash.chamadosPorStatus.PENDENTE_TRIAGEM ?? 0,
    chamados_andamento: dash.chamadosPorStatus.EM_ANDAMENTO ?? 0,
    reservas_semana: Array.isArray(dash.reservasProximos7Dias)
      ? dash.reservasProximos7Dias.length
      : 0,
    servicos_vencer: Array.isArray(dash.proximosVencimentosServicos)
      ? dash.proximosVencimentosServicos.length
      : 0,
  };
}

// ── Sub-componentes comuns ────────────────────────────────────────────────────

function CheckItem({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
        checked
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
      }`}
    >
      {checked ? <CheckSquare2 className="size-4 shrink-0" /> : <Square className="size-4 shrink-0" />}
      {label}
    </button>
  );
}

function BarraComparacao({
  valor,
  max,
  formato,
}: {
  valor: number | null;
  max: number;
  formato: MetricaDef['formato'];
}) {
  const pct = valor === null || max === 0 ? 0 : Math.min((valor / max) * 100, 100);
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/70 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-24 text-right text-sm font-medium text-foreground">
        {fmt(valor, formato)}
      </span>
    </div>
  );
}

// ── Visualização: Por Condomínio ──────────────────────────────────────────────

function VisaoCondominio({
  dados,
  metricas,
}: {
  dados: DadosCondominio[];
  metricas: MetricaId[];
}) {
  if (dados.length === 0) return null;
  const metricasDef = TODAS_METRICAS.filter((m) => metricas.includes(m.id));

  return (
    <div className="flex flex-col gap-4">
      {dados.map((cond) => (
        <Card key={cond.condominioId}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="size-4 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">{cond.nome}</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {metricasDef.map((m) => (
                <div key={m.id} className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {m.label}
                  </span>
                  <span
                    className={`text-xl font-display font-semibold ${corMetrica(cond[m.id] as number | null, m.id)}`}
                  >
                    {fmt(cond[m.id] as number | null, m.formato)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Visualização: Por Métrica ─────────────────────────────────────────────────

function VisaoMetrica({
  dados,
  metricas,
}: {
  dados: DadosCondominio[];
  metricas: MetricaId[];
}) {
  const metricasDef = TODAS_METRICAS.filter((m) => metricas.includes(m.id));

  return (
    <div className="flex flex-col gap-6">
      {metricasDef.map((m) => {
        const valores = dados.map((d) => ({ cond: d, valor: d[m.id] as number | null }));
        const maxValor = Math.max(...valores.map((v) => v.valor ?? 0), 0.01);
        const ordenados = [...valores].sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0));

        return (
          <Card key={m.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Badge className="border border-primary/30 bg-primary/10 text-primary text-xs uppercase tracking-wide">
                  {m.grupo === 'financeiro' ? 'Financeiro' : 'Operacional'}
                </Badge>
                <h3 className="font-semibold text-foreground">{m.label}</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2.5">
                {ordenados.map(({ cond, valor }) => (
                  <div key={cond.condominioId} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-sm text-muted-foreground">
                      {cond.nome}
                    </span>
                    <BarraComparacao valor={valor} max={maxValor} formato={m.formato} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Visualização: Por Unidade ─────────────────────────────────────────────────

const COR_STATUS_FINANCEIRO: Record<StatusFinanceiro, string> = {
  INADIMPLENTE: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  ADIMPLENTE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  SEM_COBRANCA: 'bg-muted text-muted-foreground border-border',
};

const LABEL_STATUS_FINANCEIRO: Record<StatusFinanceiro, string> = {
  INADIMPLENTE: 'Inadimplente',
  ADIMPLENTE: 'Adimplente',
  SEM_COBRANCA: 'Sem cobrança',
};

function CardUnidade({ u }: { u: MetricaUnidade }) {
  const [expandido, setExpandido] = useState(false);
  const temDetalhes = u.chamadosAbertos > 0 || u.flags.length > 0 || u.statusOcupacao !== null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Ícone */}
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Home className="size-4 text-primary" />
        </div>

        {/* Identificador + responsável */}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground leading-tight">{u.identificador}</p>
          {u.responsavelNome && (
            <p className="text-xs text-muted-foreground truncate">{u.responsavelNome}</p>
          )}
        </div>

        {/* Status financeiro */}
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${COR_STATUS_FINANCEIRO[u.statusFinanceiro]}`}
        >
          {LABEL_STATUS_FINANCEIRO[u.statusFinanceiro]}
        </span>

        {/* Expand toggle */}
        {temDetalhes && (
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={`size-4 transition-transform ${expandido ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>

      {/* Linha de inadimplência */}
      {u.statusFinanceiro === 'INADIMPLENTE' && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span>
            {u.totalEmAtraso.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em
            atraso · {u.diasAtraso} dia{u.diasAtraso !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Detalhes expandíveis */}
      {expandido && temDetalhes && (
        <div className="border-t border-border px-4 py-3 flex flex-wrap gap-2">
          {u.chamadosAbertos > 0 && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
              {u.chamadosAbertos} chamado{u.chamadosAbertos !== 1 ? 's' : ''} aberto{u.chamadosAbertos !== 1 ? 's' : ''}
            </span>
          )}
          {u.statusOcupacao && (
            <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              {LABEL_STATUS_OCUPACAO[u.statusOcupacao] ?? u.statusOcupacao}
            </span>
          )}
          {u.flags.map((f) => (
            <span
              key={f}
              className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs text-primary"
            >
              <Tag className="size-3" />
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

type FiltroStatus = 'TODOS' | StatusFinanceiro;

function VisaoUnidades({
  condominios,
  condominioIdInicial,
  ehAdm,
}: {
  condominios: { id: string; nome: string }[];
  condominioIdInicial: string | undefined;
  ehAdm: boolean;
}) {
  const [condominioId, setCondominioId] = useState(condominioIdInicial ?? '');
  const [unidades, setUnidades] = useState<MetricaUnidade[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('TODOS');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (!condominioId) return;
    setCarregando(true);
    setErro('');
    apiFetch<MetricaUnidade[]>(`/condominios/${condominioId}/dashboard/unidades`)
      .then(setUnidades)
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setCarregando(false));
  }, [condominioId]);

  const unidadesFiltradas = useMemo(() => {
    return unidades.filter((u) => {
      const passaStatus = filtroStatus === 'TODOS' || u.statusFinanceiro === filtroStatus;
      const passaBusca =
        busca.trim() === '' ||
        u.identificador.toLowerCase().includes(busca.toLowerCase()) ||
        (u.responsavelNome ?? '').toLowerCase().includes(busca.toLowerCase());
      return passaStatus && passaBusca;
    });
  }, [unidades, filtroStatus, busca]);

  const contagens = useMemo(() => {
    const c = { INADIMPLENTE: 0, ADIMPLENTE: 0, SEM_COBRANCA: 0 };
    for (const u of unidades) c[u.statusFinanceiro]++;
    return c;
  }, [unidades]);

  if (!condominioId) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
        <Building2 className="size-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Selecione um condomínio para ver as unidades.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Seletor de condomínio (só ADM com múltiplos) */}
      {ehAdm && condominios.length > 1 && (
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground shrink-0" />
          <select
            value={condominioId}
            onChange={(e) => setCondominioId(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {condominios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Buscar unidade ou responsável…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 w-56"
        />
        {(['TODOS', 'INADIMPLENTE', 'ADIMPLENTE', 'SEM_COBRANCA'] as FiltroStatus[]).map((s) => {
          const label =
            s === 'TODOS'
              ? `Todas (${unidades.length})`
              : s === 'INADIMPLENTE'
                ? `Inadimplentes (${contagens.INADIMPLENTE})`
                : s === 'ADIMPLENTE'
                  ? `Adimplentes (${contagens.ADIMPLENTE})`
                  : `Sem cobrança (${contagens.SEM_COBRANCA})`;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFiltroStatus(s)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filtroStatus === s
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Resumo de inadimplência */}
      {contagens.INADIMPLENTE > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-2.5 text-sm text-rose-400">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            {contagens.INADIMPLENTE} unidade{contagens.INADIMPLENTE !== 1 ? 's' : ''} inadimplente
            {contagens.INADIMPLENTE !== 1 ? 's' : ''} de {unidades.length} no total
          </span>
        </div>
      )}
      {contagens.INADIMPLENTE === 0 && unidades.length > 0 && !carregando && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-sm text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>Todas as {unidades.length} unidades estão em dia.</span>
        </div>
      )}

      {/* Lista */}
      {carregando && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
          <Home className="size-4 animate-pulse" /> Carregando unidades…
        </div>
      )}
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      {!carregando && !erro && (
        <div className="flex flex-col gap-2">
          {unidadesFiltradas.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
              <Home className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhuma unidade encontrada para os filtros selecionados.</p>
            </div>
          ) : (
            unidadesFiltradas.map((u) => <CardUnidade key={u.unidadeId} u={u} />)
          )}
        </div>
      )}
    </div>
  );
}

// ── Componente raiz ───────────────────────────────────────────────────────────

type Aba = 'condominios' | 'unidades';
type ModoCondominio = 'condominio' | 'metrica';

export function RelatoriosContent() {
  const vinculos = obterVinculos();
  const ehAdm = temPapel(vinculos, ['ADMINISTRADORA']);
  const administradoraId = vinculos.find((v) => v.papel === 'ADMINISTRADORA')?.administradoraId;
  const condominioIdSindico = vinculos.find((v) => v.papel === 'SINDICO')?.condominioId;

  const [aba, setAba] = useState<Aba>('condominios');
  const [modo, setModo] = useState<ModoCondominio>('condominio');
  const [todos, setTodos] = useState<DadosCondominio[]>([]);
  const [condominios, setCondominios] = useState<{ id: string; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  // Filtros — aba condomínios
  const [condsSelecionados, setCondsSelecionados] = useState<Set<string>>(new Set());
  const [metricasSelecionadas, setMetricasSelecionadas] = useState<Set<MetricaId>>(
    new Set(TODAS_METRICAS.map((m) => m.id)),
  );

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro('');
      try {
        if (ehAdm && administradoraId) {
          const lista = await apiFetch<{ id: string; nome: string }[]>(
            `/administradoras/${administradoraId}/condominios`,
          );
          setCondominios(lista);
          const dados = await Promise.all(lista.map((c) => buscarDadosCondominio(c.id, c.nome)));
          setTodos(dados);
          setCondsSelecionados(new Set(dados.map((d) => d.condominioId)));
        } else if (condominioIdSindico) {
          const nome = vinculos.find((v) => v.condominioId === condominioIdSindico)?.condominioId ?? '';
          setCondominios([{ id: condominioIdSindico, nome }]);
          const dados = await buscarDadosCondominio(condominioIdSindico, nome);
          setTodos([dados]);
          setCondsSelecionados(new Set([condominioIdSindico]));
        }
      } catch (e: unknown) {
        setErro(e instanceof Error ? e.message : 'Erro ao carregar dados.');
      } finally {
        setCarregando(false);
      }
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dadosFiltrados = useMemo(
    () => todos.filter((d) => condsSelecionados.has(d.condominioId)),
    [todos, condsSelecionados],
  );

  function toggleCond(id: string) {
    setCondsSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function toggleMetrica(id: MetricaId) {
    setMetricasSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function toggleTodosConds() {
    if (condsSelecionados.size === todos.length) {
      setCondsSelecionados(new Set());
    } else {
      setCondsSelecionados(new Set(todos.map((d) => d.condominioId)));
    }
  }

  function toggleTodasMetricas() {
    if (metricasSelecionadas.size === TODAS_METRICAS.length) {
      setMetricasSelecionadas(new Set());
    } else {
      setMetricasSelecionadas(new Set(TODAS_METRICAS.map((m) => m.id)));
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <BarChart3 className="size-4 animate-pulse" /> Carregando dados…
      </div>
    );
  }

  if (erro) {
    return <p className="text-sm text-destructive">{erro}</p>;
  }

  const mostrarSeletorModo = ehAdm && todos.length > 1;
  const metricasAtivas = Array.from(metricasSelecionadas);
  const porGrupo = {
    financeiro: TODAS_METRICAS.filter((m) => m.grupo === 'financeiro'),
    operacional: TODAS_METRICAS.filter((m) => m.grupo === 'operacional'),
  };
  const condominioIdUnidades = condominioIdSindico ?? condominios[0]?.id;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Abas principais ──────────────────────────────────────────── */}
      <div className="flex gap-0.5 rounded-xl bg-muted p-1 w-fit">
        {(['condominios', 'unidades'] as Aba[]).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              aba === a
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {a === 'condominios' ? 'Condomínios' : 'Unidades'}
          </button>
        ))}
      </div>

      {/* ── Aba: Condomínios ──────────────────────────────────────────── */}
      {aba === 'condominios' && (
        <>
          {mostrarSeletorModo && (
            <div className="flex gap-0.5 rounded-xl bg-muted p-1 w-fit">
              {(['condominio', 'metrica'] as ModoCondominio[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setModo(m)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    modo === m
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m === 'condominio' ? 'Por Condomínio' : 'Por Métrica'}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            {/* Painel de filtros */}
            <div className="flex flex-col gap-4">
              {todos.length > 1 && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Condomínios
                      </h4>
                      <button
                        onClick={toggleTodosConds}
                        className="text-xs text-primary hover:underline"
                      >
                        {condsSelecionados.size === todos.length ? 'Nenhum' : 'Todos'}
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1.5">
                    {todos.map((d) => (
                      <CheckItem
                        key={d.condominioId}
                        label={d.nome}
                        checked={condsSelecionados.has(d.condominioId)}
                        onChange={() => toggleCond(d.condominioId)}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Métricas
                    </h4>
                    <button
                      onClick={toggleTodasMetricas}
                      className="text-xs text-primary hover:underline"
                    >
                      {metricasSelecionadas.size === TODAS_METRICAS.length ? 'Nenhuma' : 'Todas'}
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {(['financeiro', 'operacional'] as const).map((grupo) => (
                    <div key={grupo} className="flex flex-col gap-1.5">
                      <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide">
                        {grupo === 'financeiro' ? 'Financeiro' : 'Operacional'}
                      </p>
                      {porGrupo[grupo].map((m) => (
                        <CheckItem
                          key={m.id}
                          label={m.label}
                          checked={metricasSelecionadas.has(m.id)}
                          onChange={() => toggleMetrica(m.id)}
                        />
                      ))}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Visualização */}
            <div>
              {dadosFiltrados.length === 0 || metricasAtivas.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
                  <BarChart3 className="size-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Selecione pelo menos um condomínio e uma métrica.
                  </p>
                </div>
              ) : modo === 'condominio' || !mostrarSeletorModo ? (
                <VisaoCondominio dados={dadosFiltrados} metricas={metricasAtivas} />
              ) : (
                <VisaoMetrica dados={dadosFiltrados} metricas={metricasAtivas} />
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Aba: Unidades ────────────────────────────────────────────── */}
      {aba === 'unidades' && (
        <VisaoUnidades
          condominios={condominios}
          condominioIdInicial={condominioIdUnidades}
          ehAdm={ehAdm}
        />
      )}
    </div>
  );
}
