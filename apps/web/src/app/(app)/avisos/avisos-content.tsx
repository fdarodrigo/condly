'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BellOff,
  BellRing,
  Check,
  Pencil,
  PenSquare,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ApiError, apiFetch } from '@/lib/api-client';
import { obterVinculos, temPapel } from '@/lib/auth';
import { useCondominioAtivo } from '@/lib/hooks/use-condominio-ativo';
import { usePermissoesSindico } from '@/lib/hooks/use-permissoes-sindico';
import { formatarData } from '@/lib/status-labels';
import { AvisoForm } from './aviso-form';

interface Aviso {
  id: string;
  titulo: string;
  corpo: string;
  enviadoEm: string;
  unidadeId: string | null;
}

function CondominioSelector({
  condominios,
  valor,
  onChange,
}: {
  condominios: { id: string; nome: string }[];
  valor: string;
  onChange: (id: string) => void;
}) {
  if (condominios.length <= 1) return null;
  return (
    <div className="flex items-center gap-2 mb-2">
      <Label htmlFor="avisos-condominio">Condomínio</Label>
      <select
        id="avisos-condominio"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {condominios.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ItemAvisoProps {
  aviso: Aviso;
  podeEditar: boolean;
  podeExcluir: boolean;
  onAtualizado: (atualizado: Aviso) => void;
  onRemovido: (id: string) => void;
}

function ItemAviso({ aviso, podeEditar, podeExcluir, onAtualizado, onRemovido }: ItemAvisoProps) {
  const [modo, setModo] = useState<'ver' | 'editar' | 'excluir'>('ver');
  const [titulo, setTitulo] = useState(aviso.titulo);
  const [corpo, setCorpo] = useState(aviso.corpo);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvarEdicao() {
    setSalvando(true);
    setErro(null);
    try {
      const atualizado = await apiFetch<Aviso>(`/avisos/${aviso.id}`, {
        method: 'PATCH',
        body: { titulo, corpo },
      });
      onAtualizado(atualizado);
      setModo('ver');
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    setSalvando(true);
    setErro(null);
    try {
      await apiFetch(`/avisos/${aviso.id}`, { method: 'DELETE' });
      onRemovido(aviso.id);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível excluir.');
      setSalvando(false);
      setModo('ver');
    }
  }

  return (
    <li
      data-testid="aviso-item"
      className="relative flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3"
    >
      {/* Indicador de aviso */}
      <span
        className="absolute top-4 left-1.5 size-1.5 rounded-full bg-primary"
        aria-hidden="true"
      />

      {modo === 'editar' ? (
        <div className="flex flex-col gap-3 pl-1">
          <input
            className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm font-medium focus-visible:border-ring focus-visible:outline-none"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título"
          />
          <textarea
            className="min-h-20 resize-y rounded-md border border-input bg-transparent px-3 py-1.5 text-sm focus-visible:border-ring focus-visible:outline-none"
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            placeholder="Corpo do aviso"
          />
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={salvarEdicao} disabled={salvando} className="gap-1">
              <Check className="size-3.5" aria-hidden="true" />
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setTitulo(aviso.titulo); setCorpo(aviso.corpo); setModo('ver'); }}
              disabled={salvando}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : modo === 'excluir' ? (
        <div className="flex flex-col gap-2 pl-1">
          <p className="text-sm">
            Excluir <span className="font-medium">&quot;{aviso.titulo}&quot;</span>? Esta ação não pode ser desfeita.
          </p>
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={confirmarExclusao}
              disabled={salvando}
              className="gap-1"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              {salvando ? 'Excluindo…' : 'Confirmar exclusão'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setModo('ver')}
              disabled={salvando}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 pl-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{aviso.titulo}</span>
              <span className="text-xs text-muted-foreground">
                {formatarData(aviso.enviadoEm)}
                {aviso.unidadeId && (
                  <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.6rem] font-medium text-primary">
                    unidade específica
                  </span>
                )}
              </span>
            </div>
            {(podeEditar || podeExcluir) && (
              <div className="flex shrink-0 gap-1">
                {podeEditar && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setModo('editar')}
                    className="h-7 gap-1 px-2 text-xs"
                    data-testid="aviso-editar"
                  >
                    <Pencil className="size-3" aria-hidden="true" />
                    Editar
                  </Button>
                )}
                {podeExcluir && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setModo('excluir')}
                    className="h-7 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    data-testid="aviso-excluir"
                  >
                    <X className="size-3" aria-hidden="true" />
                    Excluir
                  </Button>
                )}
              </div>
            )}
          </div>
          <p className="text-sm text-foreground/80">{aviso.corpo}</p>
        </div>
      )}
    </li>
  );
}

export function AvisosContent() {
  const {
    condominioId,
    condominios,
    selecionarCondominio,
    carregando: carregandoCondominio,
    erro: erroCondominio,
  } = useCondominioAtivo();

  const ehGestorBase = temPapel(obterVinculos(), ['ADMINISTRADORA', 'SINDICO']);
  const { permissoes } = usePermissoesSindico();
  // SINDICO sem avisosCriar ainda consegue editar/excluir (ver podeEditar por prop)
  const podeCriar = ehGestorBase && permissoes.avisosCriar;
  const podeEditar = ehGestorBase && permissoes.avisosEditar;
  const podeExcluir = ehGestorBase && permissoes.avisosExcluir;
  // Se tiver pelo menos uma permissão de escrita, mostra o painel de gestor
  const ehGestor = ehGestorBase;

  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarAvisos = useCallback(async (cId: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await apiFetch<Aviso[]>(`/condominios/${cId}/avisos`);
      setAvisos(resposta);
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar os avisos.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (condominioId) {
      void carregarAvisos(condominioId);
    }
  }, [condominioId, carregarAvisos]);

  function handleAtualizado(atualizado: Aviso) {
    setAvisos((atuais) => atuais.map((a) => (a.id === atualizado.id ? atualizado : a)));
  }

  function handleRemovido(id: string) {
    setAvisos((atuais) => atuais.filter((a) => a.id !== id));
  }

  function handleCriado() {
    if (condominioId) void carregarAvisos(condominioId);
  }

  if (carregandoCondominio) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }
  if (erroCondominio) {
    return <p className="text-sm text-destructive">{erroCondominio}</p>;
  }
  if (!condominioId) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum condomínio encontrado na carteira.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <CondominioSelector
        condominios={condominios}
        valor={condominioId}
        onChange={selecionarCondominio}
      />

      <div className={ehGestor ? 'grid gap-6 lg:grid-cols-[380px_1fr]' : ''}>
        {/* Formulário de criação — só para SINDICO/ADM com permissão */}
        {podeCriar && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PenSquare className="size-4 text-muted-foreground" aria-hidden="true" />
                Criar aviso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AvisoForm condominioId={condominioId} onCriado={handleCriado} />
            </CardContent>
          </Card>
        )}

        {/* Mural de avisos — todos os papéis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="size-4 text-muted-foreground" aria-hidden="true" />
              Mural de avisos
              {avisos.length > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[0.6875rem] font-semibold text-primary-foreground">
                  {avisos.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {erro && (
              <p role="alert" className="text-sm text-destructive mb-3" data-testid="avisos-erro">
                {erro}
              </p>
            )}
            {carregando ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : avisos.length === 0 ? (
              <div
                className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground"
                data-testid="avisos-sem-pendencia"
              >
                <BellOff className="size-6 text-muted-foreground/60" aria-hidden="true" />
                Nenhum aviso publicado.
              </div>
            ) : (
              <ul className="flex flex-col gap-2" data-testid="lista-avisos">
                {avisos.map((aviso) => (
                  <ItemAviso
                    key={aviso.id}
                    aviso={aviso}
                    podeEditar={podeEditar}
                    podeExcluir={podeExcluir}
                    onAtualizado={handleAtualizado}
                    onRemovido={handleRemovido}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
