'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiFetch } from '@/lib/api-client';

const CANAIS_DISPONIVEIS = [
  { valor: 'APP', label: 'App' },
  { valor: 'EMAIL', label: 'E-mail' },
  { valor: 'WHATSAPP', label: 'WhatsApp' },
] as const;

interface AvisoFormProps {
  condominioId: string;
  onCriado?: () => void;
}

export function AvisoForm({ condominioId, onCriado }: AvisoFormProps) {
  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [canais, setCanais] = useState<string[]>(['APP']);
  const [escopo, setEscopo] = useState<'CONDOMINIO' | 'UNIDADE'>('CONDOMINIO');
  const [unidadeId, setUnidadeId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  function alternarCanal(valor: string) {
    setCanais((atuais) =>
      atuais.includes(valor) ? atuais.filter((c) => c !== valor) : [...atuais, valor],
    );
  }

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setMensagem(null);

    if (canais.length === 0) {
      setErro('Selecione ao menos um canal.');
      return;
    }
    if (escopo === 'UNIDADE' && !unidadeId.trim()) {
      setErro('Informe o ID da unidade.');
      return;
    }

    setEnviando(true);
    try {
      await apiFetch(`/condominios/${condominioId}/avisos`, {
        method: 'POST',
        body: {
          titulo,
          corpo,
          canais,
          ...(escopo === 'UNIDADE' ? { unidadeId: unidadeId.trim() } : {}),
        },
      });
      setTitulo('');
      setCorpo('');
      setCanais(['APP']);
      setEscopo('CONDOMINIO');
      setUnidadeId('');
      setMensagem('Aviso enviado!');
      onCriado?.();
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível criar o aviso.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={aoEnviar} className="flex flex-col gap-4">
      {erro && (
        <p role="alert" className="text-sm text-destructive" data-testid="aviso-form-erro">
          {erro}
        </p>
      )}
      {mensagem && (
        <p className="text-sm text-emerald-700" data-testid="aviso-form-mensagem">
          {mensagem}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="aviso-titulo">Título</Label>
        <Input
          id="aviso-titulo"
          required
          value={titulo}
          onChange={(evento) => setTitulo(evento.target.value)}
          data-testid="aviso-titulo"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="aviso-corpo">Corpo</Label>
        <textarea
          id="aviso-corpo"
          required
          rows={4}
          className="rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm"
          value={corpo}
          onChange={(evento) => setCorpo(evento.target.value)}
          data-testid="aviso-corpo"
        />
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Canais</span>
        <div className="flex flex-wrap gap-3">
          {CANAIS_DISPONIVEIS.map((canal) => (
            <label key={canal.valor} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={canais.includes(canal.valor)}
                onChange={() => alternarCanal(canal.valor)}
                data-testid={`aviso-canal-${canal.valor.toLowerCase()}`}
              />
              {canal.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Escopo</span>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="escopo"
              checked={escopo === 'CONDOMINIO'}
              onChange={() => setEscopo('CONDOMINIO')}
              data-testid="aviso-escopo-condominio"
            />
            Condomínio inteiro
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="escopo"
              checked={escopo === 'UNIDADE'}
              onChange={() => setEscopo('UNIDADE')}
              data-testid="aviso-escopo-unidade"
            />
            Unidade específica
          </label>
          {escopo === 'UNIDADE' && (
            <Input
              placeholder="ID da unidade"
              value={unidadeId}
              onChange={(evento) => setUnidadeId(evento.target.value)}
              data-testid="aviso-unidade-id"
            />
          )}
        </div>
      </fieldset>

      <Button type="submit" disabled={enviando} data-testid="aviso-submit">
        {enviando ? 'Enviando…' : 'Enviar aviso'}
      </Button>
    </form>
  );
}
