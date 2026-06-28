'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ClipboardList, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/layout/stat-card';
import { ApiError, apiFetch } from '@/lib/api-client';
import { obterAdministradoraId, obterVinculos } from '@/lib/auth';
import { formatarMoeda } from '@/lib/status-labels';

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

interface DashboardAdministradora {
  totalChamadosAbertos: number;
  rankingArrecadacao: LinhaArrecadacao[];
  rankingInadimplencia: LinhaInadimplencia[];
  condominiosComMaisChamadosPendentes: LinhaChamadosPendentes[];
}

function formatarTaxa(taxa: number | null): string {
  if (taxa === null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 }).format(
    taxa,
  );
}

function RankBadge({ posicao }: { posicao: number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {posicao}
    </span>
  );
}

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
        setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar o dashboard.'),
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
      <p role="alert" className="text-sm text-destructive" data-testid="administradora-dashboard-erro">
        {erro}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icone={ClipboardList}
          label="Chamados abertos na carteira"
          valor={dados?.totalChamadosAbertos ?? 0}
          tom={dados?.totalChamadosAbertos ? 'destructive' : 'default'}
          dataTestId="total-chamados-abertos"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-muted-foreground" aria-hidden="true" />
              Ranking de arrecadação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dados?.rankingArrecadacao.length ? (
              <ul className="flex flex-col gap-2" data-testid="ranking-arrecadacao">
                {dados.rankingArrecadacao.map((linha, indice) => (
                  <li
                    key={linha.condominioId}
                    data-testid="ranking-arrecadacao-item"
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                  >
                    <RankBadge posicao={indice + 1} />
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{linha.nome}</span>
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {formatarTaxa(linha.taxaArrecadacao)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.round((linha.taxaArrecadacao ?? 0) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum condomínio na carteira.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="size-4 text-muted-foreground" aria-hidden="true" />
              Ranking de inadimplência
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dados?.rankingInadimplencia.length ? (
              <ul className="flex flex-col gap-2" data-testid="ranking-inadimplencia">
                {dados.rankingInadimplencia.map((linha, indice) => (
                  <li
                    key={linha.condominioId}
                    data-testid="ranking-inadimplencia-item"
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                  >
                    <RankBadge posicao={indice + 1} />
                    <span className="flex-1 text-sm font-medium">{linha.nome}</span>
                    <span className="font-mono text-sm font-semibold text-destructive">
                      {formatarMoeda(linha.totalEmAtraso)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum condomínio na carteira.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-muted-foreground" aria-hidden="true" />
            Condomínios com mais chamados pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dados?.condominiosComMaisChamadosPendentes.length ? (
            <ul className="flex flex-col gap-2" data-testid="chamados-pendentes-ranking">
              {dados.condominiosComMaisChamadosPendentes.map((linha, indice) => (
                <li
                  key={linha.condominioId}
                  data-testid="chamados-pendentes-item"
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  <RankBadge posicao={indice + 1} />
                  <span className="flex-1 text-sm font-medium">{linha.nome}</span>
                  <span className="flex size-7 items-center justify-center rounded-full bg-destructive/10 font-mono text-xs font-semibold text-destructive">
                    {linha.chamadosPendentes}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum chamado pendente na carteira.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
