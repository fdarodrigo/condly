'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, CheckCircle2, ExternalLink, Wallet } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiError, apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  COR_STATUS_COBRANCA,
  LABEL_STATUS_COBRANCA,
  formatarData,
  formatarMoeda,
} from '@/lib/status-labels';

interface SaldoResposta {
  unidadeId: string;
  cobrancaPendente: {
    id: string;
    valor: string;
    vencimento: string;
    status: string;
    linkPagamento: string | null;
  } | null;
}

export function MinhaUnidadeContent() {
  const [saldo, setSaldo] = useState<SaldoResposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<SaldoResposta>('/unidades/me/saldo')
      .then(setSaldo)
      .catch((excecao) =>
        setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar o saldo.'),
      )
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (erro) {
    return (
      <p role="alert" className="text-sm text-destructive" data-testid="minha-unidade-erro">
        {erro}
      </p>
    );
  }

  const cobranca = saldo?.cobrancaPendente;

  return (
    <div className="flex flex-col gap-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
            Seu saldo
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!cobranca ? (
            <div
              className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700"
              data-testid="saldo-sem-pendencia"
            >
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
              Você não tem nenhuma cobrança pendente.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span
                  className="font-mono text-3xl font-semibold tracking-tight text-foreground"
                  data-testid="saldo-valor"
                >
                  {formatarMoeda(cobranca.valor)}
                </span>
                <Badge variant="outline" className={COR_STATUS_COBRANCA[cobranca.status]}>
                  {LABEL_STATUS_COBRANCA[cobranca.status] ?? cobranca.status}
                </Badge>
              </div>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                Vencimento: {formatarData(cobranca.vencimento)}
              </p>
              {cobranca.linkPagamento && (
                <a
                  href={cobranca.linkPagamento}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Ver 2ª via
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              )}
            </>
          )}
          <Link
            href="/reservas"
            className={cn(buttonVariants(), 'gap-1.5')}
            data-testid="ir-para-reservas"
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            Reservar área comum
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
