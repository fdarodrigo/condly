'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Lock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ApiError, apiFetch } from '@/lib/api-client';
import { obterVinculos } from '@/lib/auth';
import { formatarHora } from '@/lib/status-labels';

interface AreaComum {
  id: string;
  nome: string;
}

interface Intervalo {
  inicio: string;
  fim: string;
}

interface DisponibilidadeResposta {
  ocupados: Intervalo[];
  livres: Intervalo[];
}

// Padrão pra "amanhã": evita cair no caso em que o horário de abertura de
// hoje já passou (a API rejeita reserva com início no passado, e os
// horários livres não descontam a hora atual do dia, só o que já está
// reservado — ver ReservasService.disponibilidade).
function amanha(): string {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() + 1);
  return data.toISOString().slice(0, 10);
}

export function ReservasContent() {
  const [areas, setAreas] = useState<AreaComum[]>([]);
  const [areaComumId, setAreaComumId] = useState('');
  const [data, setData] = useState(amanha());
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeResposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [reservando, setReservando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    const condominioId = obterVinculos().find((vinculo) => vinculo.condominioId)?.condominioId;
    if (!condominioId) {
      setCarregando(false);
      return;
    }
    apiFetch<AreaComum[]>(`/condominios/${condominioId}/areas-comuns`)
      .then((resposta) => {
        setAreas(resposta);
        if (resposta.length > 0) setAreaComumId(resposta[0].id);
      })
      .catch((excecao) =>
        setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar as áreas comuns.'),
      )
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (!areaComumId || !data) return;
    apiFetch<DisponibilidadeResposta>(
      `/areas-comuns/${areaComumId}/disponibilidade?data=${data}`,
    )
      .then(setDisponibilidade)
      .catch((excecao) =>
        setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar a disponibilidade.'),
      );
  }, [areaComumId, data]);

  async function reservar(intervalo: Intervalo) {
    setReservando(intervalo.inicio);
    setErro(null);
    setMensagem(null);
    try {
      await apiFetch(`/areas-comuns/${areaComumId}/reservas`, {
        method: 'POST',
        body: { inicio: intervalo.inicio, fim: intervalo.fim },
      });
      setMensagem('Reserva confirmada!');
      const atualizada = await apiFetch<DisponibilidadeResposta>(
        `/areas-comuns/${areaComumId}/disponibilidade?data=${data}`,
      );
      setDisponibilidade(atualizada);
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível confirmar a reserva.');
    } finally {
      setReservando(null);
    }
  }

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (areas.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma área comum cadastrada.</p>;
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
          Reservar área comum
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {erro && (
          <p role="alert" className="text-sm text-destructive" data-testid="reservas-erro">
            {erro}
          </p>
        )}
        {mensagem && (
          <div
            className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700"
            data-testid="reservas-mensagem"
          >
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            {mensagem}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="area-comum">Área comum</Label>
          <select
            id="area-comum"
            data-testid="reservas-area"
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            value={areaComumId}
            onChange={(evento) => setAreaComumId(evento.target.value)}
          >
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="data-reserva">Data</Label>
          <input
            id="data-reserva"
            type="date"
            data-testid="reservas-data"
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            value={data}
            onChange={(evento) => setData(evento.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Horários do dia</span>
          {!disponibilidade ? (
            <p className="text-sm text-muted-foreground">Selecione uma área e uma data.</p>
          ) : (
            <ul className="flex flex-col gap-1.5" data-testid="lista-horarios">
              {disponibilidade.ocupados.map((intervalo) => (
                <li
                  key={`ocupado-${intervalo.inicio}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/60 px-3 py-2 text-sm text-muted-foreground"
                >
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {formatarHora(intervalo.inicio)} – {formatarHora(intervalo.fim)}
                  </span>
                  <span className="flex items-center gap-1 text-xs" data-testid="horario-reservado">
                    <Lock className="size-3" aria-hidden="true" />
                    Reservado
                  </span>
                </li>
              ))}
              {disponibilidade.livres.map((intervalo) => (
                <li
                  key={`livre-${intervalo.inicio}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary/30 hover:bg-primary/3"
                >
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5 text-primary" aria-hidden="true" />
                    {formatarHora(intervalo.inicio)} – {formatarHora(intervalo.fim)}
                  </span>
                  <Button
                    size="sm"
                    data-testid="horario-reservar"
                    disabled={reservando === intervalo.inicio}
                    onClick={() => reservar(intervalo)}
                  >
                    {reservando === intervalo.inicio ? 'Reservando…' : 'Reservar'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
