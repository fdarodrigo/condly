'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError, apiFetch } from '@/lib/api-client';
import { obterVinculos, temPapel } from '@/lib/auth';
import { formatarData } from '@/lib/status-labels';
import { AvisoForm } from './aviso-form';

interface Aviso {
  id: string;
  titulo: string;
  corpo: string;
  enviadoEm: string;
}

export function AvisosContent() {
  const [papelCriador, setPapelCriador] = useState(false);
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [marcandoId, setMarcandoId] = useState<string | null>(null);

  const carregarNaoLidos = useCallback(async () => {
    try {
      const resposta = await apiFetch<Aviso[]>('/usuarios/me/avisos');
      setAvisos(resposta);
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar os avisos.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const vinculos = obterVinculos();
    const ehCriador = temPapel(vinculos, ['ADMINISTRADORA', 'SINDICO']);
    const ehCondomino = temPapel(vinculos, ['CONDOMINO']);
    setPapelCriador(ehCriador);

    if (ehCriador) {
      const id = vinculos.find((vinculo) => vinculo.condominioId)?.condominioId;
      setCondominioId(id ?? null);
      setCarregando(false);
      return;
    }

    if (ehCondomino) {
      void carregarNaoLidos();
      return;
    }

    setCarregando(false);
  }, [carregarNaoLidos]);

  async function marcarComoLido(avisoId: string) {
    setMarcandoId(avisoId);
    setErro(null);
    try {
      await apiFetch(`/avisos/${avisoId}/marcar-lido`, { method: 'PATCH' });
      setAvisos((atuais) => atuais.filter((aviso) => aviso.id !== avisoId));
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível marcar como lido.');
    } finally {
      setMarcandoId(null);
    }
  }

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (papelCriador) {
    if (!condominioId) {
      return (
        <p className="text-sm text-muted-foreground">
          Seu usuário não está vinculado diretamente a um condomínio específico — esta tela não se
          aplica ao seu papel.
        </p>
      );
    }
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Criar aviso</CardTitle>
        </CardHeader>
        <CardContent>
          <AvisoForm condominioId={condominioId} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {erro && (
        <p role="alert" className="text-sm text-destructive" data-testid="avisos-erro">
          {erro}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Avisos não lidos</CardTitle>
        </CardHeader>
        <CardContent>
          {avisos.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="avisos-sem-pendencia">
              Nenhum aviso novo.
            </p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="lista-avisos">
              {avisos.map((aviso) => (
                <li
                  key={aviso.id}
                  data-testid="aviso-item"
                  className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{aviso.titulo}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatarData(aviso.enviadoEm)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={marcandoId === aviso.id}
                      onClick={() => marcarComoLido(aviso.id)}
                      data-testid="aviso-marcar-lido"
                    >
                      {marcandoId === aviso.id ? 'Marcando…' : 'Marcar como lido'}
                    </Button>
                  </div>
                  <p className="text-sm">{aviso.corpo}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
