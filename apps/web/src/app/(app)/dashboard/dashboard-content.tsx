'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, ClipboardList, TrendingUp, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatCard } from '@/components/layout/stat-card';
import { ApiError, apiFetch } from '@/lib/api-client';
import { obterVinculos, temPapel } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  COR_STATUS_CHAMADO,
  LABEL_STATUS_CHAMADO,
  PONTO_STATUS_CHAMADO,
  formatarData,
  formatarMoeda,
} from '@/lib/status-labels';

interface ResumoFinanceiro {
  totalAReceberNoMes: number;
  totalRecebido: number;
  unidadesInadimplentes: { unidadeId: string; identificador: string | null; diasAtraso: number }[];
}

interface Chamado {
  id: string;
  categoria: string;
  status: string;
  criadoEm: string;
}

export function DashboardContent() {
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [podeAbrirChamado, setPodeAbrirChamado] = useState(false);
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [categoria, setCategoria] = useState('');
  const [abrindo, setAbrindo] = useState(false);

  const carregarDados = useCallback(async (id: string) => {
    setErro(null);
    try {
      const [resumoResposta, chamadosResposta] = await Promise.all([
        apiFetch<ResumoFinanceiro>(`/condominios/${id}/financeiro/resumo`),
        apiFetch<Chamado[]>(`/condominios/${id}/chamados`),
      ]);
      setResumo(resumoResposta);
      setChamados(chamadosResposta);
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar o dashboard.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const vinculos = obterVinculos();
    setPodeAbrirChamado(temPapel(vinculos, ['SINDICO']));
    const id = vinculos.find((vinculo) => vinculo.condominioId)?.condominioId;
    if (!id) {
      setCarregando(false);
      return;
    }
    setCondominioId(id);
    void carregarDados(id);
  }, [carregarDados]);

  async function aoAbrirChamado(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!condominioId) return;
    setAbrindo(true);
    setErro(null);
    try {
      await apiFetch(`/condominios/${condominioId}/chamados`, {
        method: 'POST',
        body: { categoria },
      });
      setCategoria('');
      await carregarDados(condominioId);
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível abrir o chamado.');
    } finally {
      setAbrindo(false);
    }
  }

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (!condominioId) {
    return (
      <p className="text-sm text-muted-foreground">
        Seu usuário não está vinculado diretamente a um condomínio específico — esta tela não se
        aplica ao seu papel.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {erro && (
        <p role="alert" className="text-sm text-destructive" data-testid="dashboard-erro">
          {erro}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icone={Wallet}
          label="A receber no mês"
          valor={formatarMoeda(resumo?.totalAReceberNoMes ?? 0)}
          dataTestId="resumo-a-receber"
        />
        <StatCard
          icone={TrendingUp}
          label="Recebido no mês"
          valor={formatarMoeda(resumo?.totalRecebido ?? 0)}
          tom="success"
          dataTestId="resumo-recebido"
        />
        <Card>
          <CardContent className="flex flex-col gap-3 px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                Unidades inadimplentes
              </span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <AlertTriangle className="size-4" aria-hidden="true" />
              </span>
            </div>
            {resumo?.unidadesInadimplentes.length ? (
              <ul className="flex flex-col gap-1 text-sm text-foreground/90">
                {resumo.unidadesInadimplentes.map((unidade) => (
                  <li key={unidade.unidadeId}>
                    Unidade {unidade.identificador ?? unidade.unidadeId} — {unidade.diasAtraso}{' '}
                    dia(s) de atraso
                  </li>
                ))}
              </ul>
            ) : (
              <span className="font-display text-2xl font-semibold tracking-tight text-foreground">0</span>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-4 text-muted-foreground" aria-hidden="true" />
            Chamados
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {podeAbrirChamado && (
            <form
              onSubmit={aoAbrirChamado}
              className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/40 p-3"
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="categoria">Abrir novo chamado</Label>
                <Input
                  id="categoria"
                  required
                  placeholder="Descreva o problema"
                  value={categoria}
                  onChange={(evento) => setCategoria(evento.target.value)}
                  data-testid="chamado-categoria"
                />
              </div>
              <Button type="submit" disabled={abrindo} data-testid="chamado-submit">
                {abrindo ? 'Abrindo…' : 'Abrir chamado'}
              </Button>
            </form>
          )}

          {chamados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum chamado registrado.</p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="lista-chamados">
              {chamados.map((chamado) => (
                <li
                  key={chamado.id}
                  data-testid="chamado-item"
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-primary/3"
                >
                  <span
                    className={cn('size-2 shrink-0 rounded-full', PONTO_STATUS_CHAMADO[chamado.status])}
                    aria-hidden="true"
                  />
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{chamado.categoria}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatarData(chamado.criadoEm)}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    data-testid="chamado-status"
                    className={COR_STATUS_CHAMADO[chamado.status]}
                  >
                    {LABEL_STATUS_CHAMADO[chamado.status] ?? chamado.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
