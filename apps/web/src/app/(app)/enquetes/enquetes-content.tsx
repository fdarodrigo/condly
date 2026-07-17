'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  EyeOff,
  Lock,
  Pencil,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiFetch } from '@/lib/api-client';
import { obterVinculos, temPapel } from '@/lib/auth';
import { useCondominioAtivo } from '@/lib/hooks/use-condominio-ativo';
import { usePermissoesSindico } from '@/lib/hooks/use-permissoes-sindico';
import { cn } from '@/lib/utils';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TipoEnquete = 'GESTAO' | 'SERVICO';
type StatusEnquete = 'RASCUNHO' | 'ATIVA' | 'ENCERRADA';

interface OpcaoEnquete {
  id: string;
  texto: string;
  ordem: number;
  totalVotos: number;
  votantes?: { nome: string }[];
}

interface Enquete {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: TipoEnquete;
  status: StatusEnquete;
  anonima: boolean;
  inicioEm: string;
  fimEm: string;
  criadoEm: string;
  totalVotos: number;
  meuVotoOpcaoId: string | null;
  opcoes: OpcaoEnquete[];
}

// ─── Constantes de exibição ───────────────────────────────────────────────────

const TIPO_CONFIG: Record<TipoEnquete, { label: string; classes: string }> = {
  GESTAO:  { label: 'Gestão', classes: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  SERVICO: { label: 'Serviços', classes: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
};

const STATUS_CONFIG: Record<StatusEnquete, { label: string; classes: string }> = {
  RASCUNHO:  { label: 'Rascunho', classes: 'bg-muted/60 text-muted-foreground border-border' },
  ATIVA:     { label: 'Ativa', classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  ENCERRADA: { label: 'Encerrada', classes: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
};

const OPCOES_SATISFACAO = [
  'Muito satisfeito',
  'Satisfeito',
  'Neutro',
  'Insatisfeito',
  'Muito insatisfeito',
];

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium', className)}>
      {children}
    </span>
  );
}

// ─── Barra de progresso ───────────────────────────────────────────────────────

function BarraProgresso({ opcao, total, meuVoto, podeClicar, onVotar }: {
  opcao: OpcaoEnquete;
  total: number;
  meuVoto: boolean;
  podeClicar: boolean;
  onVotar: () => void;
}) {
  const pct = total > 0 ? Math.round((opcao.totalVotos / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        {podeClicar ? (
          <button
            onClick={onVotar}
            className={cn(
              'flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
              meuVoto
                ? 'border-primary bg-primary/10 font-medium text-primary'
                : 'border-border hover:border-primary/40 hover:bg-primary/5',
            )}
          >
            <span
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-full border',
                meuVoto ? 'border-primary bg-primary' : 'border-muted-foreground/40',
              )}
            >
              {meuVoto && <Check className="size-2.5 text-primary-foreground" />}
            </span>
            {opcao.texto}
          </button>
        ) : (
          <span className="flex-1 text-sm">{opcao.texto}</span>
        )}
        <span className="shrink-0 font-display text-sm font-semibold tabular-nums">
          {pct}%
          <span className="ml-1 text-[0.6875rem] font-normal text-muted-foreground">
            ({opcao.totalVotos})
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            meuVoto ? 'bg-primary' : 'bg-primary/40',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {opcao.votantes && opcao.votantes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {opcao.votantes.map((v, i) => (
            <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] text-muted-foreground">
              {v.nome}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card de enquete ──────────────────────────────────────────────────────────

interface CardEnqueteProps {
  enquete: Enquete;
  podeGerenciar: boolean;
  podeCriar: boolean;
  podeEncerrar: boolean;
  podeExcluir: boolean;
  condominioId: string;
  onAtualizada: (e: Enquete) => void;
  onRemovida: (id: string) => void;
}

function CardEnquete({ enquete, podeGerenciar, podeCriar, podeEncerrar, podeExcluir, onAtualizada, onRemovida }: CardEnqueteProps) {
  const tipoCfg = TIPO_CONFIG[enquete.tipo];
  const statusCfg = STATUS_CONFIG[enquete.status];
  const [votando, setVotando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editTitulo, setEditTitulo] = useState(enquete.titulo);
  const [editDescricao, setEditDescricao] = useState(enquete.descricao ?? '');

  async function votar(opcaoId: string) {
    setVotando(true);
    setErro(null);
    try {
      await apiFetch(`/enquetes/${enquete.id}/votar`, {
        method: 'POST',
        body: { opcaoId },
      });
      // Reload the enquete to get updated vote counts — fetch parent reloads all
      // Using optimistic update for snappier UX
      const totalVotos = enquete.meuVotoOpcaoId ? enquete.totalVotos : enquete.totalVotos + 1;
      const atualizada: Enquete = {
        ...enquete,
        totalVotos,
        meuVotoOpcaoId: opcaoId,
        opcoes: enquete.opcoes.map((op) => ({
          ...op,
          totalVotos:
            op.id === opcaoId
              ? op.totalVotos + (enquete.meuVotoOpcaoId === op.id ? 0 : 1)
              : enquete.meuVotoOpcaoId === op.id
                ? op.totalVotos - 1
                : op.totalVotos,
          votantes: op.votantes, // server will update on next reload
        })),
      };
      onAtualizada(atualizada);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao registrar voto.');
    } finally {
      setVotando(false);
    }
  }

  async function salvarEdicao() {
    setSalvando(true);
    setErro(null);
    try {
      const atualizada = await apiFetch<Enquete>(`/enquetes/${enquete.id}`, {
        method: 'PATCH',
        body: { titulo: editTitulo, descricao: editDescricao || undefined },
      });
      onAtualizada({ ...enquete, ...atualizada });
      setEditando(false);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function publicar() {
    setSalvando(true);
    setErro(null);
    try {
      const atualizada = await apiFetch<Enquete>(`/enquetes/${enquete.id}/publicar`, { method: 'PATCH' });
      onAtualizada({ ...enquete, ...atualizada });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao publicar.');
    } finally {
      setSalvando(false);
    }
  }

  async function encerrar() {
    setSalvando(true);
    setErro(null);
    try {
      const atualizada = await apiFetch<Enquete>(`/enquetes/${enquete.id}/encerrar`, { method: 'PATCH' });
      onAtualizada({ ...enquete, ...atualizada });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao encerrar.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    setSalvando(true);
    try {
      await apiFetch(`/enquetes/${enquete.id}`, { method: 'DELETE' });
      onRemovida(enquete.id);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao excluir.');
      setSalvando(false);
      setConfirmando(false);
    }
  }

  const podeClicarVoto = enquete.status === 'ATIVA' && !votando;

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={tipoCfg.classes}>{tipoCfg.label}</Badge>
          <Badge className={statusCfg.classes}>{statusCfg.label}</Badge>
          {enquete.anonima ? (
            <Badge className="bg-muted/60 text-muted-foreground border-border">
              <EyeOff className="size-3" />Anônima
            </Badge>
          ) : (
            <Badge className="bg-muted/60 text-muted-foreground border-border">
              <Users className="size-3" />Identificada
            </Badge>
          )}
        </div>

        {editando ? (
          <div className="flex flex-col gap-2">
            <Input value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} className="font-semibold" />
            <textarea
              value={editDescricao}
              onChange={(e) => setEditDescricao(e.target.value)}
              className="min-h-16 resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:border-ring focus-visible:outline-none"
              placeholder="Descrição (opcional)"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={salvarEdicao} disabled={salvando} className="gap-1">
                <Check className="size-3.5" />
                {salvando ? 'Salvando…' : 'Salvar'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditando(false)} disabled={salvando}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-base font-semibold">{enquete.titulo}</h3>
            {enquete.descricao && (
              <p className="text-sm text-muted-foreground">{enquete.descricao}</p>
            )}
          </>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{formatarData(enquete.inicioEm)} → {formatarData(enquete.fimEm)}</span>
          <span className="flex items-center gap-1">
            <BarChart3 className="size-3" />
            {enquete.totalVotos} voto{enquete.totalVotos !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Opções */}
      {enquete.status !== 'RASCUNHO' && (
        <div className="flex flex-col gap-2">
          {enquete.opcoes.map((op) => (
            <BarraProgresso
              key={op.id}
              opcao={op}
              total={enquete.totalVotos}
              meuVoto={enquete.meuVotoOpcaoId === op.id}
              podeClicar={podeClicarVoto}
              onVotar={() => votar(op.id)}
            />
          ))}
          {enquete.status === 'ATIVA' && enquete.meuVotoOpcaoId && (
            <p className="text-xs text-primary">
              <Check className="inline size-3.5 mr-1" />
              Você já votou — clique em outra opção para alterar.
            </p>
          )}
        </div>
      )}

      {enquete.status === 'RASCUNHO' && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <p className="font-medium mb-1">Opções desta enquete:</p>
          <ul className="flex flex-col gap-1">
            {enquete.opcoes.map((op) => (
              <li key={op.id} className="flex items-center gap-2">
                <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" />
                {op.texto}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Erro / feedback */}
      {erro && <p className="text-xs text-destructive">{erro}</p>}

      {/* Ações do gestor */}
      {podeGerenciar && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {enquete.status === 'RASCUNHO' && (
            <>
              {/* Editar e publicar usam a mesma permissão de criar */}
              {podeCriar && (
                <Button size="sm" variant="outline" onClick={() => setEditando(true)} className="gap-1 h-7 px-2 text-xs">
                  <Pencil className="size-3" />Editar
                </Button>
              )}
              {podeCriar && (
                <Button size="sm" onClick={publicar} disabled={salvando} className="gap-1 h-7 px-2 text-xs">
                  <Send className="size-3" />
                  {salvando ? 'Publicando…' : 'Publicar'}
                </Button>
              )}
              {podeExcluir && (!confirmando ? (
                <Button size="sm" variant="ghost" onClick={() => setConfirmando(true)} className="gap-1 h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="size-3" />Excluir
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Confirmar?</span>
                  <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={excluir} disabled={salvando}>
                    {salvando ? '…' : 'Sim'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmando(false)}>
                    <X className="size-3" />
                  </Button>
                </div>
              ))}
            </>
          )}
          {enquete.status === 'ATIVA' && podeEncerrar && (
            <Button size="sm" variant="outline" onClick={encerrar} disabled={salvando} className="gap-1 h-7 px-2 text-xs">
              <Lock className="size-3" />
              {salvando ? 'Encerrando…' : 'Encerrar enquete'}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

// ─── Formulário de criação ────────────────────────────────────────────────────

interface FormularioEnqueteProps {
  condominioId: string;
  onCriada: (e: Enquete) => void;
}

function FormularioEnquete({ condominioId, onCriada }: FormularioEnqueteProps) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState<TipoEnquete>('GESTAO');
  const [anonima, setAnonima] = useState(true);
  const [inicioEm, setInicioEm] = useState(new Date().toISOString().slice(0, 10));
  const [fimEm, setFimEm] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [opcoes, setOpcoes] = useState<string[]>(OPCOES_SATISFACAO);
  const [novaOpcao, setNovaOpcao] = useState('');
  const [gerarAviso, setGerarAviso] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function adicionarOpcao() {
    if (!novaOpcao.trim()) return;
    setOpcoes((prev) => [...prev, novaOpcao.trim()]);
    setNovaOpcao('');
  }

  function removerOpcao(i: number) {
    setOpcoes((prev) => prev.filter((_, idx) => idx !== i));
  }

  function usarModeloSatisfacao() {
    setOpcoes([...OPCOES_SATISFACAO]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) { setErro('Título é obrigatório.'); return; }
    if (opcoes.length < 2) { setErro('Adicione ao menos 2 opções.'); return; }
    setEnviando(true);
    setErro(null);
    try {
      const criada = await apiFetch<Enquete>(
        `/condominios/${condominioId}/enquetes`,
        {
          method: 'POST',
          body: {
            titulo: titulo.trim(),
            descricao: descricao.trim() || undefined,
            tipo,
            anonima,
            inicioEm,
            fimEm,
            opcoes: opcoes.map((texto) => ({ texto })),
            gerarAviso,
          },
        },
      );
      onCriada(criada);
      setTitulo('');
      setDescricao('');
      setOpcoes([...OPCOES_SATISFACAO]);
      setGerarAviso(false);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível criar a enquete.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Título */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="enq-titulo">Título *</Label>
        <Input id="enq-titulo" placeholder="Ex: Como avalia a gestão deste mês?" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </div>

      {/* Descrição */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="enq-descricao">Descrição</Label>
        <textarea
          id="enq-descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Contexto adicional (opcional)"
          className="min-h-14 resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none"
        />
      </div>

      {/* Tipo */}
      <div className="flex flex-col gap-1.5">
        <Label>Tipo</Label>
        <div className="flex gap-2">
          {(['GESTAO', 'SERVICO'] as TipoEnquete[]).map((t) => (
            <label key={t} className={cn(
              'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              tipo === t ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/40',
            )}>
              <input type="radio" className="sr-only" checked={tipo === t} onChange={() => setTipo(t)} />
              {TIPO_CONFIG[t].label}
            </label>
          ))}
        </div>
      </div>

      {/* Datas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="enq-inicio">Início</Label>
          <Input id="enq-inicio" type="date" value={inicioEm} onChange={(e) => setInicioEm(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="enq-fim">Encerramento</Label>
          <Input id="enq-fim" type="date" value={fimEm} onChange={(e) => setFimEm(e.target.value)} />
        </div>
      </div>

      {/* Opções */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Opções de resposta *</Label>
          <button type="button" onClick={usarModeloSatisfacao} className="text-xs text-primary hover:underline">
            Usar modelo padrão
          </button>
        </div>
        <ul className="flex flex-col gap-1">
          {opcoes.map((op, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-sm">
              <span className="flex-1">{op}</span>
              {opcoes.length > 2 && (
                <button type="button" onClick={() => removerOpcao(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            placeholder="Nova opção…"
            value={novaOpcao}
            onChange={(e) => setNovaOpcao(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarOpcao(); } }}
            className="h-8 text-sm"
          />
          <Button type="button" size="sm" variant="outline" onClick={adicionarOpcao} className="shrink-0 gap-1">
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Anonimato */}
      <div className="flex flex-col gap-2">
        <Label>Visibilidade dos votos</Label>
        <div className="flex gap-2">
          <label className={cn(
            'flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
            anonima ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/40',
          )}>
            <input type="radio" className="sr-only" checked={anonima} onChange={() => setAnonima(true)} />
            <EyeOff className="size-4" />
            <div>
              <p className="font-medium">Anônima</p>
              <p className="text-xs opacity-70">Só contagens visíveis</p>
            </div>
          </label>
          <label className={cn(
            'flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
            !anonima ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/40',
          )}>
            <input type="radio" className="sr-only" checked={!anonima} onChange={() => setAnonima(false)} />
            <Users className="size-4" />
            <div>
              <p className="font-medium">Identificada</p>
              <p className="text-xs opacity-70">Exibe quem votou em quê</p>
            </div>
          </label>
        </div>
      </div>

      {/* Gerar aviso */}
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={gerarAviso}
          onChange={(e) => setGerarAviso(e.target.checked)}
        />
        <span className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-input transition-colors peer-checked:border-primary peer-checked:bg-primary',
        )}>
          {gerarAviso && <svg className="size-2.5 text-primary-foreground" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Bell className="size-3.5 text-primary" />
            Anunciar via app
          </span>
          <span className="text-xs text-muted-foreground">
            Envia aviso convidando os moradores a votarem.
          </span>
        </div>
      </label>

      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}

      <Button type="submit" disabled={enviando} className="gap-1.5 self-start">
        <Plus className="size-4" />
        {enviando ? 'Criando…' : 'Criar enquete'}
      </Button>
    </form>
  );
}

// ─── Seletor de condomínio ────────────────────────────────────────────────────

function CondominioSelector({
  condominios, valor, onChange,
}: { condominios: { id: string; nome: string }[]; valor: string; onChange: (id: string) => void }) {
  if (condominios.length <= 1) return null;
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="enq-condominio">Condomínio</Label>
      <select
        id="enq-condominio"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {condominios.map((c) => (
          <option key={c.id} value={c.id}>{c.nome}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export function EnquetesContent() {
  const { condominioId, condominios, selecionarCondominio, carregando: carregandoCondominio, erro: erroCondominio } = useCondominioAtivo();
  const podeGerenciar = temPapel(obterVinculos(), ['ADMINISTRADORA', 'SINDICO']);
  const { permissoes } = usePermissoesSindico();

  const [enquetes, setEnquetes] = useState<Enquete[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarEnquetes = useCallback(async (cId: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await apiFetch<Enquete[]>(`/condominios/${cId}/enquetes`);
      setEnquetes(resposta);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar as enquetes.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (condominioId) void carregarEnquetes(condominioId);
  }, [condominioId, carregarEnquetes]);

  if (carregandoCondominio) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (erroCondominio) return <p className="text-sm text-destructive">{erroCondominio}</p>;
  if (!condominioId) return <p className="text-sm text-muted-foreground">Nenhum condomínio encontrado.</p>;

  const ativas = enquetes.filter((e) => e.status === 'ATIVA').length;
  const encerradas = enquetes.filter((e) => e.status === 'ENCERRADA').length;

  return (
    <div className="flex flex-col gap-4">
      <CondominioSelector condominios={condominios} valor={condominioId} onChange={selecionarCondominio} />

      {/* Resumo */}
      {enquetes.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {ativas > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {ativas} ativa{ativas !== 1 ? 's' : ''}
            </span>
          )}
          {encerradas > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              {encerradas} encerrada{encerradas !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <div className={cn('grid gap-6', podeGerenciar && 'lg:grid-cols-[380px_1fr]')}>
        {/* Formulário — só gestor com permissão de criar */}
        {podeGerenciar && permissoes.enquetesCriar && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="size-4 text-muted-foreground" />
                Nova enquete
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormularioEnquete
                condominioId={condominioId}
                onCriada={(nova) => setEnquetes((prev) => [nova, ...prev])}
              />
            </CardContent>
          </Card>
        )}

        {/* Lista */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-4 text-muted-foreground" />
              Enquetes
              {enquetes.length > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[0.6875rem] font-semibold text-primary-foreground">
                  {enquetes.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {erro && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {erro}
              </div>
            )}
            {carregando ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : enquetes.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <BarChart3 className="size-8 text-muted-foreground/40" />
                {podeGerenciar ? 'Crie a primeira enquete ao lado.' : 'Nenhuma enquete disponível.'}
              </div>
            ) : (
              <ul className="flex flex-col gap-4" data-testid="lista-enquetes">
                {enquetes.map((enquete) => (
                  <CardEnquete
                    key={enquete.id}
                    enquete={enquete}
                    podeGerenciar={podeGerenciar}
                    podeCriar={permissoes.enquetesCriar}
                    podeEncerrar={permissoes.enquetesEncerrar}
                    podeExcluir={permissoes.enquetesExcluir}
                    condominioId={condominioId}
                    onAtualizada={(atualizada) =>
                      setEnquetes((prev) => prev.map((e) => (e.id === atualizada.id ? { ...e, ...atualizada } : e)))
                    }
                    onRemovida={(id) => setEnquetes((prev) => prev.filter((e) => e.id !== id))}
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
