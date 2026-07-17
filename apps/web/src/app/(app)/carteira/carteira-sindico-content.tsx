'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ClipboardList, TrendingUp, Wallet, Wrench } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api-client';
import { obterVinculos } from '@/lib/auth';
import { StatCard } from '@/components/layout/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  formatarData,
  formatarMoeda,
  LABEL_STATUS_CHAMADO,
  COR_STATUS_CHAMADO,
} from '@/lib/status-labels';
import { Badge } from '@/components/ui/badge';

interface ResumoFinanceiro {
  totalAReceberNoMes: number;
  totalRecebido: number;
  unidadesInadimplentes: {
    unidadeId: string;
    identificador: string | null;
    diasAtraso: number;
  }[];
}

interface ServicoPeriodico {
  id: string;
  nome: string;
  proximoVencimento: string;
}

interface DashboardCondominio {
  taxaArrecadacao: number | null;
  chamadosPorStatus: Record<string, number>;
  proximosVencimentosServicos: ServicoPeriodico[];
}

export function CarteiraSindicoContent() {
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [dashboard, setDashboard] = useState<DashboardCondominio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const vinculos = obterVinculos();
    const id = vinculos.find((v) => v.condominioId && v.papel === 'SINDICO')?.condominioId;
    if (!id) {
      setCarregando(false);
      return;
    }
    setCondominioId(id);

    Promise.all([
      apiFetch<ResumoFinanceiro>(`/condominios/${id}/financeiro/resumo`),
      apiFetch<DashboardCondominio>(`/condominios/${id}/dashboard`),
    ])
      .then(([r, d]) => {
        setResumo(r);
        setDashboard(d);
      })
      .catch((e) => {
        setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar os dados.');
      })
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (erro) return <p className="text-sm text-destructive">{erro}</p>;
  if (!condominioId) {
    return (
      <p className="text-sm text-muted-foreground">
        Usuário não vinculado diretamente a um condomínio como síndico.
      </p>
    );
  }

  const chamadosPorStatus = dashboard?.chamadosPorStatus ?? {};
  const totalChamadosAbertos =
    (chamadosPorStatus['PENDENTE_TRIAGEM'] ?? 0) +
    (chamadosPorStatus['ABERTO'] ?? 0) +
    (chamadosPorStatus['EM_ANDAMENTO'] ?? 0);

  const taxaFmt =
    dashboard?.taxaArrecadacao != null
      ? `${dashboard.taxaArrecadacao.toFixed(1)}%`
      : '—';

  return (
    <div className="flex flex-col gap-6">
      {/* KPIs financeiros */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icone={Wallet}
          label="A receber no mês"
          valor={formatarMoeda(resumo?.totalAReceberNoMes ?? 0)}
        />
        <StatCard
          icone={TrendingUp}
          label="Recebido no mês"
          valor={formatarMoeda(resumo?.totalRecebido ?? 0)}
          tom="success"
        />
        <StatCard
          icone={TrendingUp}
          label="Taxa de arrecadação"
          valor={taxaFmt}
          tom={
            dashboard?.taxaArrecadacao != null && dashboard.taxaArrecadacao < 80
              ? 'destructive'
              : 'success'
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Inadimplentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-muted-foreground" aria-hidden="true" />
              Unidades inadimplentes
              {(resumo?.unidadesInadimplentes.length ?? 0) > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-destructive text-[0.6875rem] font-semibold text-white">
                  {resumo!.unidadesInadimplentes.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!resumo?.unidadesInadimplentes.length ? (
              <p className="text-sm text-muted-foreground">Nenhuma unidade inadimplente.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {resumo.unidadesInadimplentes.map((u) => (
                  <li key={u.unidadeId} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-foreground">
                      Unidade {u.identificador ?? u.unidadeId}
                    </span>
                    <span className="text-xs text-destructive">{u.diasAtraso} dia(s) de atraso</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Chamados por status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-muted-foreground" aria-hidden="true" />
              Chamados em aberto
              {totalChamadosAbertos > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[0.6875rem] font-semibold text-primary-foreground">
                  {totalChamadosAbertos}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalChamadosAbertos === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum chamado em aberto.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {(['PENDENTE_TRIAGEM', 'ABERTO', 'EM_ANDAMENTO'] as const).map((status) => {
                  const qtd = chamadosPorStatus[status] ?? 0;
                  if (!qtd) return null;
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <Badge
                        className={`border text-xs ${COR_STATUS_CHAMADO[status] ?? ''}`}
                      >
                        {LABEL_STATUS_CHAMADO[status] ?? status}
                      </Badge>
                      <span className="font-display text-sm font-semibold text-foreground">{qtd}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Próximos vencimentos de serviços */}
      {(dashboard?.proximosVencimentosServicos.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="size-4 text-muted-foreground" aria-hidden="true" />
              Próximos vencimentos de serviços
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {dashboard!.proximosVencimentosServicos.map((s) => (
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
