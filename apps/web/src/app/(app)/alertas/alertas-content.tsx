'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Wrench,
} from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api-client';
import { useCondominioAtivo } from '@/lib/hooks/use-condominio-ativo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatarData } from '@/lib/status-labels';

/* ──────────────────────────── tipos ──────────────────────────── */

interface Chamado {
  id: string;
  titulo: string;
  status: string;
  unidade?: { identificador: string | null } | null;
}

interface Assembleia {
  id: string;
  titulo: string;
  dataHora: string;
}

interface ServicoPeriodico {
  id: string;
  nome: string;
  proximoVencimento: string;
}

interface ResumoFinanceiro {
  totalAReceberNoMes: number;
  totalRecebido: number;
  unidadesInadimplentes: {
    unidadeId: string;
    identificador: string | null;
    diasAtraso: number;
  }[];
}

interface DashboardCondominio {
  proximosVencimentosServicos: ServicoPeriodico[];
}

/* ──────────────────────────── helpers ──────────────────────────── */

function diasAte(dataStr: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(dataStr);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

/* ──────────────────────────── componente ──────────────────────────── */

export function AlertasContent() {
  const { condominioId, carregando: carregandoCondominio } = useCondominioAtivo();
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [assembleias, setAssembleias] = useState<Assembleia[]>([]);
  const [dashboard, setDashboard] = useState<DashboardCondominio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (carregandoCondominio) return;
    if (!condominioId) {
      setCarregando(false);
      return;
    }

    Promise.all([
      apiFetch<ResumoFinanceiro>(`/condominios/${condominioId}/financeiro/resumo`),
      apiFetch<Chamado[]>(`/condominios/${condominioId}/chamados`),
      apiFetch<Assembleia[]>(`/condominios/${condominioId}/assembleias`),
      apiFetch<DashboardCondominio>(`/condominios/${condominioId}/dashboard`),
    ])
      .then(([r, c, a, d]) => {
        setResumo(r);
        setChamados(c);
        setAssembleias(a);
        setDashboard(d);
      })
      .catch((e) => {
        setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar os alertas.');
      })
      .finally(() => setCarregando(false));
  }, [condominioId, carregandoCondominio]);

  if (carregandoCondominio || carregando)
    return <p className="text-sm text-muted-foreground">Carregando alertas…</p>;
  if (erro) return <p className="text-sm text-destructive">{erro}</p>;
  if (!condominioId)
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum condomínio selecionado.
      </p>
    );

  /* ── derivação dos alertas ── */

  const inadimplentes = resumo?.unidadesInadimplentes ?? [];

  const chamadosPendentes = chamados.filter((c) => c.status === 'PENDENTE_TRIAGEM');

  const assembleiasProximas = assembleias.filter((a) => {
    const d = diasAte(a.dataHora);
    return d >= 0 && d <= 7;
  });

  const servicosProximos = dashboard?.proximosVencimentosServicos ?? [];

  const totalAlertas =
    inadimplentes.length +
    chamadosPendentes.length +
    assembleiasProximas.length +
    servicosProximos.length;

  if (totalAlertas === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="size-7 text-primary" aria-hidden="true" />
        </span>
        <p className="text-base font-semibold text-foreground">Tudo em dia!</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Nenhum alerta pendente para este condomínio. Bom trabalho!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cobranças em atraso */}
      {inadimplentes.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-7 items-center justify-center rounded-full bg-destructive/15">
                <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
              </span>
              Cobranças em atraso
              <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-destructive text-[0.6875rem] font-semibold text-white">
                {inadimplentes.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {inadimplentes.map((u) => (
                <li key={u.unidadeId} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-foreground">
                    Unidade {u.identificador ?? u.unidadeId}
                  </span>
                  <span className="text-xs text-destructive">{u.diasAtraso} dia(s) de atraso</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Chamados sem triagem */}
      {chamadosPendentes.length > 0 && (
        <Card className="border-yellow-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-7 items-center justify-center rounded-full bg-yellow-500/15">
                <ClipboardList className="size-4 text-yellow-500" aria-hidden="true" />
              </span>
              Chamados aguardando triagem
              <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-yellow-500 text-[0.6875rem] font-semibold text-white">
                {chamadosPendentes.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {chamadosPendentes.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-foreground">{c.titulo}</span>
                  {c.unidade?.identificador && (
                    <span className="text-xs text-muted-foreground">
                      Unidade {c.unidade.identificador}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Assembleias nos próximos 7 dias */}
      {assembleiasProximas.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary/10">
                <CalendarDays className="size-4 text-primary" aria-hidden="true" />
              </span>
              Assembleias nos próximos 7 dias
              <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[0.6875rem] font-semibold text-primary-foreground">
                {assembleiasProximas.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {assembleiasProximas.map((a) => {
                const d = diasAte(a.dataHora);
                return (
                  <li key={a.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-foreground">{a.titulo}</span>
                    <span className="text-xs text-primary">
                      {d === 0 ? 'Hoje' : d === 1 ? 'Amanhã' : `em ${d} dias`} —{' '}
                      {formatarData(a.dataHora)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Serviços periódicos a vencer */}
      {servicosProximos.length > 0 && (
        <Card className="border-blue-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-7 items-center justify-center rounded-full bg-blue-500/15">
                <Wrench className="size-4 text-blue-400" aria-hidden="true" />
              </span>
              Serviços periódicos a vencer
              <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-blue-500 text-[0.6875rem] font-semibold text-white">
                {servicosProximos.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {servicosProximos.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-foreground">{s.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatarData(s.proximoVencimento)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
