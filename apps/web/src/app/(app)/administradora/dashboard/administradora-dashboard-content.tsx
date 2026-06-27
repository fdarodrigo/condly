'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <Card className="max-w-xs">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Chamados abertos na carteira</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold" data-testid="total-chamados-abertos">
          {dados?.totalChamadosAbertos ?? 0}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ranking de arrecadação</CardTitle>
          </CardHeader>
          <CardContent>
            {dados?.rankingArrecadacao.length ? (
              <ul className="flex flex-col gap-2" data-testid="ranking-arrecadacao">
                {dados.rankingArrecadacao.map((linha) => (
                  <li
                    key={linha.condominioId}
                    data-testid="ranking-arrecadacao-item"
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <span className="text-sm font-medium">{linha.nome}</span>
                    <Badge variant="outline">{formatarTaxa(linha.taxaArrecadacao)}</Badge>
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
            <CardTitle>Ranking de inadimplência</CardTitle>
          </CardHeader>
          <CardContent>
            {dados?.rankingInadimplencia.length ? (
              <ul className="flex flex-col gap-2" data-testid="ranking-inadimplencia">
                {dados.rankingInadimplencia.map((linha) => (
                  <li
                    key={linha.condominioId}
                    data-testid="ranking-inadimplencia-item"
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <span className="text-sm font-medium">{linha.nome}</span>
                    <span className="text-sm">{formatarMoeda(linha.totalEmAtraso)}</span>
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
          <CardTitle>Condomínios com mais chamados pendentes</CardTitle>
        </CardHeader>
        <CardContent>
          {dados?.condominiosComMaisChamadosPendentes.length ? (
            <ul className="flex flex-col gap-2" data-testid="chamados-pendentes-ranking">
              {dados.condominiosComMaisChamadosPendentes.map((linha) => (
                <li
                  key={linha.condominioId}
                  data-testid="chamados-pendentes-item"
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <span className="text-sm font-medium">{linha.nome}</span>
                  <Badge variant="outline">{linha.chamadosPendentes}</Badge>
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
