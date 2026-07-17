'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  MapPin,
  Paperclip,
  Pencil,
  Play,
  Plus,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api-client';
import { obterVinculos, temPapel } from '@/lib/auth';
import { useCondominioAtivo } from '@/lib/hooks/use-condominio-ativo';
import { usePermissoesSindico } from '@/lib/hooks/use-permissoes-sindico';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

// ── Tipos ───────────────────────────────────────────────────────────────────

type TipoAssembleia = 'ORDINARIA' | 'EXTRAORDINARIA';
type StatusAssembleia = 'AGENDADA' | 'REALIZADA' | 'CANCELADA';

interface PautaAssembleia {
  id: string;
  ordem: number;
  titulo: string;
  descricao?: string | null;
  deliberacao?: string | null;
}

interface AssembleiaDocumento {
  id: string;
  titulo: string;
  url?: string | null;
}

interface Assembleia {
  id: string;
  titulo: string;
  tipo: TipoAssembleia;
  status: StatusAssembleia;
  dataHora: string;
  local?: string | null;
  linkGravacao?: string | null;
  acrescimoTaxa?: number | null;
  acrescimoAte?: string | null;
  pautas: PautaAssembleia[];
  documentos: AssembleiaDocumento[];
}

// ── Labels e cores ───────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<TipoAssembleia, { label: string; classe: string }> = {
  ORDINARIA: {
    label: 'Ordinária',
    classe: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
  EXTRAORDINARIA: {
    label: 'Extraordinária',
    classe: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  },
};

const STATUS_CONFIG: Record<StatusAssembleia, { label: string; classe: string }> = {
  AGENDADA: {
    label: 'Agendada',
    classe: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  REALIZADA: {
    label: 'Realizada',
    classe: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  CANCELADA: {
    label: 'Cancelada',
    classe: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
};

function formatarDataHora(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Seletor de condomínio (inline, mesmo padrão dos outros conteúdos) ────────

function CondominioSelector({
  condominios,
  condominioId,
  onSelecionar,
}: {
  condominios: { id: string; nome: string }[];
  condominioId: string;
  onSelecionar: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-muted-foreground">Condomínio:</label>
      <select
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        value={condominioId}
        onChange={(e) => onSelecionar(e.target.value)}
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

// ── Formulário de criação ─────────────────────────────────────────────────────

interface PautaInput {
  titulo: string;
  descricao: string;
}

function FormularioAssembleia({
  condominioId,
  onCriada,
}: {
  condominioId: string;
  onCriada: (criada: Assembleia) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<TipoAssembleia>('ORDINARIA');
  const [dataHora, setDataHora] = useState('');
  const [local, setLocal] = useState('');
  const [pautas, setPautas] = useState<PautaInput[]>([{ titulo: '', descricao: '' }]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  function adicionarPauta() {
    setPautas((prev) => [...prev, { titulo: '', descricao: '' }]);
  }

  function removerPauta(i: number) {
    if (pautas.length === 1) return;
    setPautas((prev) => prev.filter((_, idx) => idx !== i));
  }

  function atualizarPauta(i: number, campo: keyof PautaInput, valor: string) {
    setPautas((prev) => prev.map((p, idx) => (idx === i ? { ...p, [campo]: valor } : p)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!titulo.trim() || !dataHora || pautas.some((p) => !p.titulo.trim())) {
      setErro('Preencha o título, a data/hora e o título de todas as pautas.');
      return;
    }
    setCarregando(true);
    try {
      const criada = await apiFetch<Assembleia>(`/condominios/${condominioId}/assembleias`, {
        method: 'POST',
        body: {
          titulo: titulo.trim(),
          tipo,
          dataHora,
          local: local.trim() || undefined,
          pautas: pautas
            .filter((p) => p.titulo.trim())
            .map((p) => ({
              titulo: p.titulo.trim(),
              descricao: p.descricao.trim() || undefined,
            })),
        },
      });
      setTitulo('');
      setTipo('ORDINARIA');
      setDataHora('');
      setLocal('');
      setPautas([{ titulo: '', descricao: '' }]);
      onCriada(criada);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível criar a assembleia.');
    } finally {
      setCarregando(false);
    }
  }

  const inputClass =
    'w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-sm font-semibold text-foreground">Nova Assembleia</h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Título</label>
            <input
              className={inputClass}
              placeholder="Ex.: Assembleia Geral Ordinária — 1º semestre"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <select
                className={inputClass}
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoAssembleia)}
              >
                <option value="ORDINARIA">Ordinária</option>
                <option value="EXTRAORDINARIA">Extraordinária</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Data e Hora</label>
              <input
                type="datetime-local"
                className={inputClass}
                value={dataHora}
                onChange={(e) => setDataHora(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Local (opcional)</label>
            <input
              className={inputClass}
              placeholder="Ex.: Salão de festas"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Pautas</label>
              <button
                type="button"
                onClick={adicionarPauta}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="size-3" /> Adicionar pauta
              </button>
            </div>
            {pautas.map((p, i) => (
              <div key={i} className="rounded-lg border border-border bg-background/50 p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-2 text-xs font-bold text-muted-foreground">{i + 1}.</span>
                  <div className="flex flex-1 flex-col gap-2">
                    <input
                      className={inputClass}
                      placeholder="Título da pauta"
                      value={p.titulo}
                      onChange={(e) => atualizarPauta(i, 'titulo', e.target.value)}
                    />
                    <textarea
                      className={`${inputClass} resize-none`}
                      rows={2}
                      placeholder="Descrição (opcional)"
                      value={p.descricao}
                      onChange={(e) => atualizarPauta(i, 'descricao', e.target.value)}
                    />
                  </div>
                  {pautas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removerPauta(i)}
                      className="mt-2 text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {erro && <p className="text-xs text-destructive">{erro}</p>}

          <Button type="submit" disabled={carregando} className="self-end">
            {carregando ? 'Salvando…' : 'Criar Assembleia'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Painel de resultados / edição de deliberações ────────────────────────────

// modo 'realizar': muda status para REALIZADA ao salvar (assembly AGENDADA)
// modo 'editar':   só atualiza deliberações/gravação/docs, sem mudar status

function PainelResultados({
  assembleia,
  modo,
  onAtualizado,
}: {
  assembleia: Assembleia;
  modo: 'realizar' | 'editar';
  onAtualizado: () => void;
}) {
  const [deliberacoes, setDeliberacoes] = useState<Record<string, string>>(
    Object.fromEntries(assembleia.pautas.map((p) => [p.id, p.deliberacao ?? ''])),
  );
  const [linkGravacao, setLinkGravacao] = useState(assembleia.linkGravacao ?? '');
  const [acrescimoTaxa, setAcrescimoTaxa] = useState(
    assembleia.acrescimoTaxa != null ? String(assembleia.acrescimoTaxa) : '',
  );
  const [acrescimoAte, setAcrescimoAte] = useState(
    assembleia.acrescimoAte ? assembleia.acrescimoAte.slice(0, 10) : '',
  );
  const [novoDocTitulo, setNovoDocTitulo] = useState('');
  const [novoDocUrl, setNovoDocUrl] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvarResultados() {
    setErro('');
    setCarregando(true);
    try {
      const taxaNum = acrescimoTaxa.trim() ? parseFloat(acrescimoTaxa.trim()) : null;
      await apiFetch<Assembleia>(`/assembleias/${assembleia.id}`, {
        method: 'PATCH',
        body: {
          ...(modo === 'realizar' && { status: 'REALIZADA' }),
          linkGravacao: linkGravacao.trim() || null,
          acrescimoTaxa: taxaNum,
          acrescimoAte: acrescimoAte || null,
          pautas: assembleia.pautas.map((p) => ({
            id: p.id,
            deliberacao: deliberacoes[p.id]?.trim() || null,
          })),
        },
      });
      onAtualizado();
    } catch {
      setErro('Erro ao salvar. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  async function adicionarDoc() {
    if (!novoDocTitulo.trim()) return;
    try {
      await apiFetch<AssembleiaDocumento>(`/assembleias/${assembleia.id}/documentos`, {
        method: 'POST',
        body: {
          titulo: novoDocTitulo.trim(),
          url: novoDocUrl.trim() || undefined,
        },
      });
      setNovoDocTitulo('');
      setNovoDocUrl('');
      onAtualizado();
    } catch {
      // falha silenciosa — o campo permanece preenchido
    }
  }

  async function removerDoc(docId: string) {
    try {
      await apiFetch<null>(`/assembleias/${assembleia.id}/documentos/${docId}`, {
        method: 'DELETE',
      });
      onAtualizado();
    } catch {
      // falha silenciosa
    }
  }

  const inputClass =
    'w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="flex flex-col gap-5 pt-2">
      {/* Deliberações */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Deliberações
        </p>
        {assembleia.pautas.map((p) => (
          <div key={p.id} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-foreground">
              {p.ordem}. {p.titulo}
            </label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={3}
              placeholder="Decisão tomada nesta pauta…"
              value={deliberacoes[p.id] ?? ''}
              onChange={(e) =>
                setDeliberacoes((prev) => ({ ...prev, [p.id]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>

      {/* Gravação */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Link da gravação (opcional)
        </label>
        <input
          className={inputClass}
          placeholder="https://…"
          value={linkGravacao}
          onChange={(e) => setLinkGravacao(e.target.value)}
        />
      </div>

      {/* Acréscimo na taxa */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Acréscimo na taxa de condomínio (opcional)
        </p>
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Valor (R$)</label>
            <input
              className={inputClass}
              type="number"
              min="0"
              step="0.01"
              placeholder="Ex: 50,00"
              value={acrescimoTaxa}
              onChange={(e) => setAcrescimoTaxa(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Válido até</label>
            <input
              className={inputClass}
              type="date"
              value={acrescimoAte}
              onChange={(e) => setAcrescimoAte(e.target.value)}
            />
          </div>
        </div>
        {acrescimoTaxa && !acrescimoAte && (
          <p className="text-xs text-amber-400">Informe até quando o acréscimo será cobrado.</p>
        )}
      </div>

      {/* Documentos */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Documentos utilizados
        </p>
        {assembleia.documentos.map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2"
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm text-foreground">{d.titulo}</span>
            {d.url && (
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                <ExternalLink className="size-4" />
              </a>
            )}
            <button
              onClick={() => removerDoc(d.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            className={inputClass}
            placeholder="Nome do documento"
            value={novoDocTitulo}
            onChange={(e) => setNovoDocTitulo(e.target.value)}
          />
          <input
            className={`${inputClass} max-w-[180px]`}
            placeholder="URL (opcional)"
            value={novoDocUrl}
            onChange={(e) => setNovoDocUrl(e.target.value)}
          />
          <Button type="button" variant="outline" size="sm" onClick={adicionarDoc}>
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {erro && <p className="text-xs text-destructive">{erro}</p>}

      <Button onClick={salvarResultados} disabled={carregando} className="self-start">
        {carregando
          ? 'Salvando…'
          : modo === 'realizar'
            ? 'Marcar como Realizada'
            : 'Salvar alterações'}
      </Button>
    </div>
  );
}

// ── Card da assembleia ────────────────────────────────────────────────────────

function CardAssembleia({
  assembleia,
  ehGestor,
  podeRegistrarResultados,
  podeCancelar,
  podeExcluir,
  onAtualizado,
}: {
  assembleia: Assembleia;
  ehGestor: boolean;
  podeRegistrarResultados: boolean;
  podeCancelar: boolean;
  podeExcluir: boolean;
  onAtualizado: () => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const [modoResultados, setModoResultados] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [carregandoExcluir, setCarregandoExcluir] = useState(false);

  const tipo = TIPO_CONFIG[assembleia.tipo];
  const status = STATUS_CONFIG[assembleia.status];
  const temDeliberacoes = assembleia.pautas.some((p) => p.deliberacao);

  async function excluir() {
    if (!confirm('Excluir esta assembleia? Esta ação não pode ser desfeita.')) return;
    setCarregandoExcluir(true);
    try {
      await apiFetch<null>(`/assembleias/${assembleia.id}`, { method: 'DELETE' });
      onAtualizado();
    } catch {
      setCarregandoExcluir(false);
    }
  }

  async function cancelar() {
    if (!confirm('Cancelar esta assembleia?')) return;
    try {
      await apiFetch<Assembleia>(`/assembleias/${assembleia.id}`, {
        method: 'PATCH',
        body: { status: 'CANCELADA' },
      });
      onAtualizado();
    } catch {
      // falha silenciosa
    }
  }

  return (
    <Card>
      <CardContent className="pt-4">
        {/* Cabeçalho — flex-wrap: em telas estreitas a fileira de ações (que
            não encolhe) quebra pra linha de baixo em vez de estourar o card. */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="size-5 text-primary" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`${tipo.classe} border text-xs`}>{tipo.label}</Badge>
              <Badge className={`${status.classe} border text-xs`}>{status.label}</Badge>
            </div>
            <h3 className="font-semibold text-foreground">{assembleia.titulo}</h3>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {formatarDataHora(assembleia.dataHora)}
              </span>
              {assembleia.local && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  {assembleia.local}
                </span>
              )}
              <span className="flex items-center gap-1">
                <FileText className="size-3" />
                {assembleia.pautas.length} pauta{assembleia.pautas.length !== 1 ? 's' : ''}
              </span>
              {assembleia.documentos.length > 0 && (
                <span className="flex items-center gap-1">
                  <Paperclip className="size-3" />
                  {assembleia.documentos.length} doc.
                </span>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {assembleia.linkGravacao && (
              <a
                href={assembleia.linkGravacao}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Video className="size-3.5" />
                Gravação
              </a>
            )}
            {ehGestor && assembleia.status === 'AGENDADA' && podeRegistrarResultados && !modoResultados && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setModoResultados(true);
                  setExpandido(true);
                }}
              >
                <Play className="size-3.5" />
                Registrar resultados
              </Button>
            )}
            {ehGestor && assembleia.status === 'REALIZADA' && podeRegistrarResultados && !modoEdicao && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setModoEdicao(true);
                  setExpandido(true);
                }}
              >
                <Pencil className="size-3.5" />
                Editar deliberações
              </Button>
            )}
            {ehGestor && assembleia.status === 'AGENDADA' && podeCancelar && (
              <button
                onClick={cancelar}
                className="text-muted-foreground hover:text-amber-400"
                title="Cancelar assembleia"
              >
                <X className="size-4" />
              </button>
            )}
            {ehGestor && assembleia.status === 'AGENDADA' && podeExcluir && (
              <button
                onClick={excluir}
                disabled={carregandoExcluir}
                className="text-muted-foreground hover:text-destructive"
                title="Excluir assembleia"
              >
                <Trash2 className="size-4" />
              </button>
            )}
            <button
              onClick={() => setExpandido((v) => !v)}
              className="text-muted-foreground hover:text-foreground"
            >
              {expandido ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
            </button>
          </div>
        </div>

        {/* Conteúdo expandido */}
        {expandido && (
          <div className="mt-4 border-t border-border pt-4">
            {modoResultados ? (
              <PainelResultados
                assembleia={assembleia}
                modo="realizar"
                onAtualizado={() => {
                  setModoResultados(false);
                  onAtualizado();
                }}
              />
            ) : modoEdicao ? (
              <PainelResultados
                assembleia={assembleia}
                modo="editar"
                onAtualizado={() => {
                  setModoEdicao(false);
                  onAtualizado();
                }}
              />
            ) : (
              <div className="flex flex-col gap-4">
                {/* Pautas e deliberações */}
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pautas{temDeliberacoes ? ' e Deliberações' : ''}
                  </p>
                  {assembleia.pautas.map((p) => (
                    <div key={p.id} className="flex gap-3">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {p.ordem}
                      </span>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-foreground">{p.titulo}</p>
                        {p.descricao && (
                          <p className="text-xs text-muted-foreground">{p.descricao}</p>
                        )}
                        {p.deliberacao && (
                          <div className="mt-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                              Deliberação
                            </p>
                            <p className="mt-0.5 text-sm text-foreground">{p.deliberacao}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Documentos (somente leitura) */}
                {assembleia.documentos.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Documentos
                    </p>
                    {assembleia.documentos.map((d) => (
                      <div key={d.id} className="flex items-center gap-2">
                        <FileText className="size-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">{d.titulo}</span>
                        {d.url && (
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="size-3" /> Abrir
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Acréscimo na taxa (somente leitura) */}
                {assembleia.acrescimoTaxa != null && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
                      Acréscimo na taxa de condomínio
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      R${' '}
                      {Number(assembleia.acrescimoTaxa).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      {assembleia.acrescimoAte && (
                        <span className="ml-1 font-normal text-muted-foreground">
                          — válido até{' '}
                          {new Date(assembleia.acrescimoAte).toLocaleDateString('pt-BR', {
                            timeZone: 'UTC',
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export function AssembleiasContent() {
  const { condominioId, condominios, selecionarCondominio, carregando: condCarregando } =
    useCondominioAtivo();
  const [assembleias, setAssembleias] = useState<Assembleia[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [ehGestor, setEhGestor] = useState(false);
  const { permissoes } = usePermissoesSindico();

  useEffect(() => {
    const vinculos = obterVinculos();
    setEhGestor(temPapel(vinculos, ['ADMINISTRADORA', 'SINDICO']));
  }, []);

  async function carregar() {
    if (!condominioId) return;
    setCarregando(true);
    try {
      const lista = await apiFetch<Assembleia[]>(`/condominios/${condominioId}/assembleias`);
      setAssembleias(lista);
    } catch (e) {
      setErroLista(e instanceof ApiError ? e.message : 'Não foi possível carregar as assembleias.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominioId]);

  if (condCarregando) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (!condominioId) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum condomínio vinculado à sua conta.</p>
    );
  }

  const agendadas = assembleias.filter((a) => a.status === 'AGENDADA');
  const realizadas = assembleias.filter((a) => a.status === 'REALIZADA');
  const canceladas = assembleias.filter((a) => a.status === 'CANCELADA');

  return (
    <div className="flex flex-col gap-6">
      {condominios.length > 1 && (
        <CondominioSelector
          condominios={condominios}
          condominioId={condominioId}
          onSelecionar={selecionarCondominio}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Formulário — só gestores com permissão de criar */}
        {ehGestor && permissoes.assembleiasCriar && (
          <div>
            <FormularioAssembleia
              condominioId={condominioId}
              onCriada={(nova) => setAssembleias((prev) => [nova, ...prev])}
            />
          </div>
        )}

        {/* Lista de assembleias */}
        <div className={`flex flex-col gap-6 ${!ehGestor ? 'lg:col-span-2' : ''}`}>
          {carregando && (
            <p className="text-sm text-muted-foreground">Carregando assembleias…</p>
          )}

          {erroLista && (
            <p role="alert" className="text-sm text-destructive">{erroLista}</p>
          )}

          {!carregando && !erroLista && assembleias.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
              <Building2 className="size-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhuma assembleia registrada.</p>
              {ehGestor && (
                <p className="text-xs text-muted-foreground/70">
                  Crie a primeira assembleia usando o formulário ao lado.
                </p>
              )}
            </div>
          )}

          {agendadas.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Agendadas</h2>
                <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs">
                  {agendadas.length}
                </Badge>
              </div>
              {agendadas.map((a) => (
                <CardAssembleia
                  key={a.id}
                  assembleia={a}
                  ehGestor={ehGestor}
                  podeRegistrarResultados={permissoes.assembleiasRegistrarResultados}
                  podeCancelar={permissoes.assembleiasCancelar}
                  podeExcluir={permissoes.assembleiasExcluir}
                  onAtualizado={carregar}
                />
              ))}
            </section>
          )}

          {realizadas.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Realizadas</h2>
                <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs">
                  {realizadas.length}
                </Badge>
              </div>
              {realizadas.map((a) => (
                <CardAssembleia
                  key={a.id}
                  assembleia={a}
                  ehGestor={ehGestor}
                  podeRegistrarResultados={permissoes.assembleiasRegistrarResultados}
                  podeCancelar={permissoes.assembleiasCancelar}
                  podeExcluir={permissoes.assembleiasExcluir}
                  onAtualizado={carregar}
                />
              ))}
            </section>
          )}

          {canceladas.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Canceladas</h2>
              {canceladas.map((a) => (
                <CardAssembleia
                  key={a.id}
                  assembleia={a}
                  ehGestor={ehGestor}
                  podeRegistrarResultados={permissoes.assembleiasRegistrarResultados}
                  podeCancelar={permissoes.assembleiasCancelar}
                  podeExcluir={permissoes.assembleiasExcluir}
                  onAtualizado={carregar}
                />
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
