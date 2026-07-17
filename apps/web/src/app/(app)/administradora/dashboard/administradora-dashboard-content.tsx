'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  Receipt,
  SmilePlus,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/layout/stat-card';
import { ApiError, apiFetch } from '@/lib/api-client';
import { obterAdministradoraId, obterVinculos } from '@/lib/auth';
import { gerarBalancoMock, gerarSatisfacaoMock } from '@/lib/mock-dashboard-adm';
import { formatarData, formatarMoeda } from '@/lib/status-labels';

// ─── tipos vindos da API ──────────────────────────────────────────────────────

interface LinhaArrecadacao {
  condominioId: string;
  nome: string;
  totalRecebidoNoMes: number;
  totalAReceberNoMes: number;
  taxaArrecadacao: number | null;
}

interface LinhaInadimplencia {
  condominioId: string;
  nome: string;
  totalEmAtraso: number;
}

interface LinhaChamadosPendentes {
  condominioId: string;
  nome: string;
  chamadosPendentes: number;
}

interface InadimplenciaPorFaixa {
  de1a30d: number;
  de31a60d: number;
  de61a90d: number;
  de90dMais: number;
}

interface ServicoAVencer {
  id: string;
  nome: string;
  proximoVencimento: string;
  condominio: { id: string; nome: string };
}

interface DashboardAdministradora {
  totalChamadosAbertos: number;
  rankingArrecadacao: LinhaArrecadacao[];
  rankingInadimplencia: LinhaInadimplencia[];
  condominiosComMaisChamadosPendentes: LinhaChamadosPendentes[];
  inadimplenciaPorFaixa: InadimplenciaPorFaixa;
  servicosAVencer: ServicoAVencer[];
}

// ─── sub-componentes genéricos ────────────────────────────────────────────────

function BadgeMock() {
  return (
    <Badge
      variant="outline"
      className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-400 text-[0.6875rem]"
    >
      <FlaskConical className="size-3" aria-hidden="true" />
      Dados simulados
    </Badge>
  );
}

function RankBadge({ posicao }: { posicao: number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {posicao}
    </span>
  );
}

function LinkVerTodos() {
  return (
    <a
      href="/relatorios"
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      Ver todos
      <ArrowRight className="size-3" aria-hidden="true" />
    </a>
  );
}

function CardHeaderComAcao({
  icone: Icone,
  titulo,
  acao,
  badge,
}: {
  icone: React.ElementType;
  titulo: string;
  acao?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
        <Icone className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1">{titulo}</span>
        {badge}
        {acao}
      </CardTitle>
    </CardHeader>
  );
}

// ─── seção: faixas de inadimplência ──────────────────────────────────────────

function SecaoFaixasInadimplencia({ faixas }: { faixas: InadimplenciaPorFaixa }) {
  const itens = [
    { label: '1 – 30 dias', valor: faixas.de1a30d, cor: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
    { label: '31 – 60 dias', valor: faixas.de31a60d, cor: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    { label: '61 – 90 dias', valor: faixas.de61a90d, cor: 'text-red-400 bg-red-500/10 border-red-500/20' },
    { label: '+ de 90 dias', valor: faixas.de90dMais, cor: 'text-red-300 bg-red-600/15 border-red-500/30' },
  ];

  return (
    <Card>
      <CardHeaderComAcao icone={TrendingDown} titulo="Inadimplência por faixa de atraso" />
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {itens.map((item) => (
            <div
              key={item.label}
              className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 ${item.cor}`}
            >
              <span className="text-[0.6875rem] font-medium uppercase tracking-wide opacity-70">
                {item.label}
              </span>
              <span className="font-display text-base font-semibold">
                {formatarMoeda(item.valor)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── seção: ranking de arrecadação ───────────────────────────────────────────

const TOP_ARRECADACAO = 5;

function SecaoArrecadacao({ ranking }: { ranking: LinhaArrecadacao[] }) {
  const top = ranking.slice(0, TOP_ARRECADACAO);
  return (
    <Card>
      <CardHeaderComAcao
        icone={TrendingUp}
        titulo="Ranking de arrecadação"
        acao={ranking.length > TOP_ARRECADACAO ? <LinkVerTodos /> : undefined}
      />
      <CardContent>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum condomínio na carteira.</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="ranking-arrecadacao">
            {top.map((linha, i) => (
              <li
                key={linha.condominioId}
                data-testid="ranking-arrecadacao-item"
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <RankBadge posicao={i + 1} />
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{linha.nome}</span>
                    <span className="font-display text-sm font-semibold">
                      {linha.taxaArrecadacao !== null
                        ? new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 }).format(linha.taxaArrecadacao)
                        : '—'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.round((linha.taxaArrecadacao ?? 0) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[0.6875rem] text-muted-foreground">
                    <span>Recebido: {formatarMoeda(linha.totalRecebidoNoMes)}</span>
                    <span>A receber: {formatarMoeda(linha.totalAReceberNoMes)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── seção: maiores dívidas ───────────────────────────────────────────────────

const TOP_INADIMPLENCIA = 5;

function SecaoMaioresDividas({ ranking }: { ranking: LinhaInadimplencia[] }) {
  const top = ranking.filter((l) => l.totalEmAtraso > 0).slice(0, TOP_INADIMPLENCIA);
  return (
    <Card>
      <CardHeaderComAcao
        icone={AlertTriangle}
        titulo="Maiores dívidas em atraso"
        acao={ranking.filter((l) => l.totalEmAtraso > 0).length > TOP_INADIMPLENCIA ? <LinkVerTodos /> : undefined}
      />
      <CardContent>
        {top.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
            Nenhuma inadimplência registrada na carteira.
          </div>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="ranking-inadimplencia">
            {top.map((linha, i) => (
              <li
                key={linha.condominioId}
                data-testid="ranking-inadimplencia-item"
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <RankBadge posicao={i + 1} />
                <span className="flex-1 text-sm font-medium">{linha.nome}</span>
                <span className="font-display text-sm font-semibold text-destructive">
                  {formatarMoeda(linha.totalEmAtraso)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── seção: chamados pendentes ────────────────────────────────────────────────

function SecaoChamadosPendentes({ ranking }: { ranking: LinhaChamadosPendentes[] }) {
  return (
    <Card>
      <CardHeaderComAcao
        icone={ClipboardList}
        titulo="Condomínios com mais chamados abertos"
        acao={<LinkVerTodos />}
      />
      <CardContent>
        {ranking.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum chamado aberto na carteira.</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="chamados-pendentes-ranking">
            {ranking.map((linha, i) => (
              <li
                key={linha.condominioId}
                data-testid="chamados-pendentes-item"
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <RankBadge posicao={i + 1} />
                <span className="flex-1 text-sm font-medium">{linha.nome}</span>
                {linha.chamadosPendentes > 0 ? (
                  <span className="flex size-7 items-center justify-center rounded-full bg-destructive/10 font-display text-xs font-semibold text-destructive">
                    {linha.chamadosPendentes}
                  </span>
                ) : (
                  <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── seção: renovações próximas (API) ────────────────────────────────────────

function urgencia(proximoVencimento: string): 'critico' | 'atencao' | 'ok' {
  const dias = Math.ceil(
    (new Date(proximoVencimento).getTime() - Date.now()) / 86_400_000,
  );
  if (dias <= 7) return 'critico';
  if (dias <= 15) return 'atencao';
  return 'ok';
}

const COR_URGENCIA = {
  critico: 'border-destructive/30 bg-destructive/10 text-destructive',
  atencao: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
  ok: 'border-primary/20 bg-primary/5 text-primary',
};

function SecaoRenovacoes({ servicos }: { servicos: ServicoAVencer[] }) {
  return (
    <Card>
      <CardHeaderComAcao icone={Calendar} titulo="Renovações próximas (30 dias)" />
      <CardContent>
        {servicos.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
            Nenhuma renovação nos próximos 30 dias.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {servicos.map((s) => {
              const u = urgencia(s.proximoVencimento);
              return (
                <li
                  key={s.id}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${COR_URGENCIA[u]}`}
                >
                  <Calendar className="size-4 shrink-0" aria-hidden="true" />
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium text-foreground">{s.nome}</span>
                    <span className="text-xs text-muted-foreground">{s.condominio.nome}</span>
                  </div>
                  <span className="text-xs font-medium whitespace-nowrap">
                    {formatarData(s.proximoVencimento)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── seção: satisfação / NPS (MOCK) ──────────────────────────────────────────

function NpsGauge({ nps }: { nps: number }) {
  const pct = (nps / 10) * 100;
  const cor =
    nps >= 7 ? 'bg-primary' : nps >= 5 ? 'bg-yellow-400' : 'bg-destructive';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct}%` }} />
      </div>
      <span
        className={`font-display text-sm font-semibold ${nps >= 7 ? 'text-primary' : nps >= 5 ? 'text-yellow-400' : 'text-destructive'}`}
      >
        {nps.toFixed(1)}
      </span>
    </div>
  );
}

const TOP_SATISFACAO = 5;

function SecaoSatisfacao({
  condominios,
}: {
  condominios: { condominioId: string; nome: string }[];
}) {
  const dados = useMemo(() => gerarSatisfacaoMock(condominios), [condominios]);
  const top = dados.slice(0, TOP_SATISFACAO);

  return (
    <Card>
      <CardHeaderComAcao
        icone={SmilePlus}
        titulo="Satisfação dos moradores"
        badge={<BadgeMock />}
        acao={dados.length > TOP_SATISFACAO ? <LinkVerTodos /> : undefined}
      />
      <CardContent>
        <p className="mb-3 text-[0.6875rem] text-muted-foreground/70">
          Score NPS 0–10 · simulado até integração com pesquisas de satisfação
        </p>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum condomínio na carteira.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {top.map((linha, i) => (
              <li
                key={linha.condominioId}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
              >
                <RankBadge posicao={i + 1} />
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium">{linha.nome}</span>
                  <span className="text-[0.6875rem] text-muted-foreground">
                    {linha.respondentes} respondentes
                  </span>
                </div>
                <NpsGauge nps={linha.nps} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── seção: balanços receitas × despesas (MOCK) ───────────────────────────────

function BarraBalanco({
  receita,
  despesa,
  maxTotal,
}: {
  receita: number;
  despesa: number;
  maxTotal: number;
}) {
  const escala = maxTotal > 0 ? 100 / maxTotal : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="w-16 text-right text-[0.6875rem] text-muted-foreground">Receita</span>
        <div className="flex-1 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${receita * escala}%` }} />
        </div>
        <span className="font-display text-[0.6875rem] font-medium text-foreground w-20 text-right">
          {formatarMoeda(receita)}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-16 text-right text-[0.6875rem] text-muted-foreground">Despesa</span>
        <div className="flex-1 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-destructive/70"
            style={{ width: `${despesa * escala}%` }}
          />
        </div>
        <span className="font-display text-[0.6875rem] font-medium text-foreground w-20 text-right">
          {formatarMoeda(despesa)}
        </span>
      </div>
    </div>
  );
}

const TOP_BALANCOS = 4;

function SecaoBalancos({ rankingArrecadacao }: { rankingArrecadacao: LinhaArrecadacao[] }) {
  const dados = useMemo(
    () =>
      gerarBalancoMock(
        rankingArrecadacao.map((l) => ({
          condominioId: l.condominioId,
          nome: l.nome,
          receitaReal: l.totalRecebidoNoMes,
        })),
      ),
    [rankingArrecadacao],
  );

  const top = dados.slice(0, TOP_BALANCOS);
  const maxTotal = Math.max(...dados.map((d) => Math.max(d.receita, d.despesa)), 1);

  return (
    <Card>
      <CardHeaderComAcao
        icone={Wallet}
        titulo="Balanço receitas × despesas"
        badge={<BadgeMock />}
        acao={dados.length > TOP_BALANCOS ? <LinkVerTodos /> : undefined}
      />
      <CardContent>
        <p className="mb-3 text-[0.6875rem] text-muted-foreground/70">
          Receita = arrecadação real do mês · Despesa = estimativa simulada até módulo de despesas
        </p>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum condomínio na carteira.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {top.map((linha) => (
              <li key={linha.condominioId} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{linha.nome}</span>
                  <span
                    className={`font-display text-xs font-semibold ${linha.saldo >= 0 ? 'text-primary' : 'text-destructive'}`}
                  >
                    Saldo: {formatarMoeda(linha.saldo)}
                  </span>
                </div>
                <BarraBalanco receita={linha.receita} despesa={linha.despesa} maxTotal={maxTotal} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── componente principal (usado pelo DashboardRouter em /dashboard) ──────────

export function AdministradoraDashboardContent() {
  const [administradoraId, setAdministradoraId] = useState<string | null>(null);
  const [dados, setDados] = useState<DashboardAdministradora | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const id = obterAdministradoraId(obterVinculos());
    if (!id) {
      setCarregando(false);
      return;
    }
    setAdministradoraId(id);
    apiFetch<DashboardAdministradora>(`/administradoras/${id}/dashboard`)
      .then(setDados)
      .catch((excecao) =>
        setErro(
          excecao instanceof ApiError
            ? excecao.message
            : 'Não foi possível carregar o dashboard.',
        ),
      )
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (!administradoraId) {
    return (
      <p className="text-sm text-muted-foreground">
        Seu usuário não está vinculado a uma administradora — esta tela não se aplica ao seu papel.
      </p>
    );
  }

  if (erro) {
    return (
      <p
        role="alert"
        className="text-sm text-destructive"
        data-testid="administradora-dashboard-erro"
      >
        {erro}
      </p>
    );
  }

  const totalAReceberNoMes = (dados?.rankingArrecadacao ?? []).reduce(
    (s, l) => s + l.totalAReceberNoMes,
    0,
  );
  const totalRecebidoNoMes = (dados?.rankingArrecadacao ?? []).reduce(
    (s, l) => s + l.totalRecebidoNoMes,
    0,
  );
  const totalEmAtraso = (dados?.rankingInadimplencia ?? []).reduce(
    (s, l) => s + l.totalEmAtraso,
    0,
  );

  const condominiosParaMock = (dados?.rankingArrecadacao ?? []).map((l) => ({
    condominioId: l.condominioId,
    nome: l.nome,
  }));

  return (
    <div className="flex flex-col gap-6">

      {/* ── KPIs ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icone={Receipt}
          label="A receber este mês"
          valor={formatarMoeda(totalAReceberNoMes)}
          dataTestId="total-a-receber"
        />
        <StatCard
          icone={Banknote}
          label="Arrecadado este mês"
          valor={formatarMoeda(totalRecebidoNoMes)}
          tom="success"
          dataTestId="total-arrecadado"
        />
        <StatCard
          icone={TrendingDown}
          label="Total em atraso"
          valor={formatarMoeda(totalEmAtraso)}
          tom={totalEmAtraso > 0 ? 'destructive' : 'default'}
          dataTestId="total-em-atraso"
        />
        <StatCard
          icone={ClipboardList}
          label="Chamados abertos"
          valor={dados?.totalChamadosAbertos ?? 0}
          tom={dados?.totalChamadosAbertos ? 'destructive' : 'default'}
          dataTestId="total-chamados-abertos"
        />
      </div>

      {/* ── Aviso de seções simuladas ── */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-400">
        <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Seções com{' '}
          <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[0.6875rem] font-medium">
            <FlaskConical className="size-3" />
            Dados simulados
          </span>{' '}
          usam valores gerados localmente e serão substituídas quando os módulos correspondentes forem implementados.
        </span>
      </div>

      {/* ── Arrecadação + Faixas de inadimplência ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SecaoArrecadacao ranking={dados?.rankingArrecadacao ?? []} />
        <SecaoFaixasInadimplencia
          faixas={dados?.inadimplenciaPorFaixa ?? { de1a30d: 0, de31a60d: 0, de61a90d: 0, de90dMais: 0 }}
        />
      </div>

      {/* ── Maiores dívidas + Chamados ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SecaoMaioresDividas ranking={dados?.rankingInadimplencia ?? []} />
        <SecaoChamadosPendentes ranking={dados?.condominiosComMaisChamadosPendentes ?? []} />
      </div>

      {/* ── Renovações próximas (API) ── */}
      <SecaoRenovacoes servicos={dados?.servicosAVencer ?? []} />

      {/* ── Satisfação + Balanços (MOCK) ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SecaoSatisfacao condominios={condominiosParaMock} />
        <SecaoBalancos rankingArrecadacao={dados?.rankingArrecadacao ?? []} />
      </div>

      {/* ── Placeholders de módulos futuros ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { icone: Building2, titulo: 'Assembleias', descricao: 'Atas e pautas — disponível em breve.' },
          { icone: ClipboardList, titulo: 'Portaria & Acesso', descricao: 'Controle de acesso — disponível em breve.' },
        ].map((item) => (
          <div
            key={item.titulo}
            className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-muted-foreground/60"
          >
            <item.icone className="size-4 shrink-0" aria-hidden="true" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-foreground/50">{item.titulo}</span>
              <span className="text-xs">{item.descricao}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
