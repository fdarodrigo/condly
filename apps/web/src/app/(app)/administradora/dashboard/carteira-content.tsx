'use client';

import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react';
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

interface DashboardAdministradora {
  totalChamadosAbertos: number;
  rankingArrecadacao: LinhaArrecadacao[];
  rankingInadimplencia: LinhaInadimplencia[];
}

export function CarteiraContent() {
  const [dados, setDados] = useState<DashboardAdministradora | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const id = obterAdministradoraId(obterVinculos());
    if (!id) { setCarregando(false); return; }
    apiFetch<DashboardAdministradora>(`/administradoras/${id}/dashboard`)
      .then(setDados)
      .catch((e) => setErro(e instanceof ApiError ? e.message : 'Erro ao carregar.'))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (erro) return <p className="text-sm text-destructive">{erro}</p>;

  const condominios = dados?.rankingArrecadacao ?? [];
  const inadimplenciaPorId = new Map(
    (dados?.rankingInadimplencia ?? []).map((l) => [l.condominioId, l.totalEmAtraso]),
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {condominios.length} condomínio{condominios.length !== 1 ? 's' : ''} na carteira ·{' '}
        {dados?.totalChamadosAbertos ?? 0} chamado{(dados?.totalChamadosAbertos ?? 0) !== 1 ? 's' : ''} aberto{(dados?.totalChamadosAbertos ?? 0) !== 1 ? 's' : ''}
      </p>

      {condominios.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum condomínio registrado na carteira.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {condominios.map((c) => {
            const atraso = inadimplenciaPorId.get(c.condominioId) ?? 0;
            return (
              <li
                key={c.condominioId}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30 hover:bg-primary/3"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="size-4" aria-hidden="true" />
                </span>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">{c.nome}</span>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="size-3 text-primary" />
                      Arrecadado: {formatarMoeda(c.totalRecebidoNoMes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingDown className={`size-3 ${atraso > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                      Em atraso: {formatarMoeda(atraso)}
                    </span>
                  </div>
                </div>
                {c.taxaArrecadacao !== null && (
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-display text-sm font-semibold">
                      {new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 }).format(c.taxaArrecadacao)}
                    </span>
                    <span className="text-[0.6875rem] text-muted-foreground">arrecadado</span>
                  </div>
                )}
                {atraso === 0 && c.taxaArrecadacao !== null && (
                  <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
