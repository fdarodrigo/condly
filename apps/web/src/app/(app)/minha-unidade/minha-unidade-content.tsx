'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiError, apiFetch } from '@/lib/api-client';
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
          <CardTitle>Seu saldo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!cobranca ? (
            <p className="text-sm text-muted-foreground" data-testid="saldo-sem-pendencia">
              Você não tem nenhuma cobrança pendente.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-semibold" data-testid="saldo-valor">
                  {formatarMoeda(cobranca.valor)}
                </span>
                <Badge variant="outline" className={COR_STATUS_COBRANCA[cobranca.status]}>
                  {LABEL_STATUS_COBRANCA[cobranca.status] ?? cobranca.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Vencimento: {formatarData(cobranca.vencimento)}
              </p>
              {cobranca.linkPagamento && (
                <a
                  href={cobranca.linkPagamento}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary underline"
                >
                  Ver 2ª via
                </a>
              )}
            </>
          )}
          <Link href="/reservas" className={buttonVariants()} data-testid="ir-para-reservas">
            Reservar área comum
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
