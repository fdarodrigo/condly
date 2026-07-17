'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Info, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { obterUsuarioId, obterVinculos, temPapel } from '@/lib/auth';
import { useCondominioAtivo } from '@/lib/hooks/use-condominio-ativo';
import { usePermissoesSindico } from '@/lib/hooks/use-permissoes-sindico';
import {
  LABEL_STATUS_CHAMADO,
  COR_STATUS_CHAMADO,
  PONTO_STATUS_CHAMADO,
  formatarData,
} from '@/lib/status-labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

// ── Constantes ────────────────────────────────────────────────────────────────

const CATEGORIAS: { valor: string; label: string }[] = [
  { valor: 'MANUTENCAO', label: 'Manutenção' },
  { valor: 'VAZAMENTO', label: 'Vazamento/Infiltração' },
  { valor: 'BARULHO', label: 'Barulho/Perturbação' },
  { valor: 'LIMPEZA', label: 'Limpeza' },
  { valor: 'SEGURANCA', label: 'Segurança' },
  { valor: 'ILUMINACAO', label: 'Iluminação/Elétrica' },
  { valor: 'ELEVADOR', label: 'Elevador' },
  { valor: 'AREA_COMUM', label: 'Área Comum' },
  { valor: 'PORTARIA', label: 'Portaria/Acesso' },
  { valor: 'OUTRO', label: 'Outro' },
];

const LABEL_CATEGORIA: Record<string, string> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.valor, c.label]),
);

const STATUS_TRANSICOES: Record<string, string[]> = {
  PENDENTE_TRIAGEM: ['ABERTO'],
  ABERTO: ['EM_ANDAMENTO'],
  EM_ANDAMENTO: ['RESOLVIDO'],
  RESOLVIDO: ['ABERTO'],
};

const LABEL_STATUS_OCUPACAO: Record<string, string> = {
  PROPRIETARIO: 'Proprietário',
  INQUILINO: 'Inquilino',
  VAZIA: 'Vazia',
};

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Chamado {
  id: string;
  titulo: string;
  descricao?: string | null;
  categoria: string;
  status: string;
  criadoEm: string;
  reabertoEm?: string | null;
  abertoPorId: string;
  unidade?: { id: string; identificador: string } | null;
  abertoPor: { nome: string };
  responsavel?: { nome: string } | null;
}

interface Veiculo {
  placa: string;
  modelo: string;
  cor: string;
}

interface DadosUnidade {
  bebeRecemNascido: boolean;
  trabalhadorNoturno: boolean;
  pessoasIdosas: boolean;
  pets: boolean;
  petsDescricao?: string | null;
  pessoasAutismo: boolean;
  pessoasAutismoDescricao?: string | null;
  estrangeiros: boolean;
  mobilidadeReduzida: boolean;
  locacaoCurtaTemporada: boolean;
  statusOcupacao: string;
  veiculos: Veiculo[];
  contatoEmergenciaNome?: string | null;
  contatoEmergenciaTelefone?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

// ── Painel de dados da unidade (só para gestores) ─────────────────────────────

function PainelDadosUnidade({ unidadeId }: { unidadeId: string }) {
  const [dados, setDados] = useState<DadosUnidade | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    apiFetch<DadosUnidade | null>(`/unidades/${unidadeId}/dados`)
      .then(setDados)
      .catch(() => setDados(null))
      .finally(() => setCarregando(false));
  }, [unidadeId]);

  if (carregando) return <p className="text-xs text-muted-foreground">Carregando dados…</p>;
  if (!dados) return <p className="text-xs text-muted-foreground italic">Nenhum dado complementar cadastrado para esta unidade.</p>;

  const flags: { label: string; ativo: boolean; detalhe?: string | null }[] = [
    { label: 'Bebê recém-nascido', ativo: dados.bebeRecemNascido },
    { label: 'Trabalhador noturno', ativo: dados.trabalhadorNoturno },
    { label: 'Pessoas idosas', ativo: dados.pessoasIdosas },
    { label: 'Pets', ativo: dados.pets, detalhe: dados.petsDescricao },
    { label: 'Autismo / deficiência comportamental', ativo: dados.pessoasAutismo, detalhe: dados.pessoasAutismoDescricao },
    { label: 'Estrangeiros', ativo: dados.estrangeiros },
    { label: 'Mobilidade reduzida', ativo: dados.mobilidadeReduzida },
    { label: 'Locação curta temporada / Airbnb', ativo: dados.locacaoCurtaTemporada },
  ];

  const flagsAtivas = flags.filter((f) => f.ativo);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dados da unidade</p>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">
          Status: <span className="text-foreground font-medium">{LABEL_STATUS_OCUPACAO[dados.statusOcupacao] ?? dados.statusOcupacao}</span>
        </span>
        {dados.contatoEmergenciaNome && (
          <span className="text-muted-foreground">
            Emergência: <span className="text-foreground font-medium">{dados.contatoEmergenciaNome}</span>
            {dados.contatoEmergenciaTelefone && ` · ${dados.contatoEmergenciaTelefone}`}
          </span>
        )}
      </div>

      {flagsAtivas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {flagsAtivas.map((f) => (
            <span key={f.label} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
              {f.label}{f.detalhe ? `: ${f.detalhe}` : ''}
            </span>
          ))}
        </div>
      )}

      {dados.veiculos.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Veículos</p>
          <div className="flex flex-col gap-1">
            {dados.veiculos.map((v, i) => (
              <span key={i} className="text-xs text-foreground/80">
                {v.placa} — {v.modelo} ({v.cor})
              </span>
            ))}
          </div>
        </div>
      )}

      {flagsAtivas.length === 0 && !dados.contatoEmergenciaNome && dados.veiculos.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Sem características especiais registradas.</p>
      )}
    </div>
  );
}

// ── Formulário de criação ──────────────────────────────────────────────────────

function FormularioChamado({
  condominioId,
  onCriado,
  onCancelar,
}: {
  condominioId: string;
  onCriado: () => void;
  onCancelar: () => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('OUTRO');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) { setErro('Informe um título.'); return; }
    setSalvando(true); setErro('');
    try {
      await apiFetch(`/condominios/${condominioId}/chamados`, {
        method: 'POST',
        body: { titulo: titulo.trim(), descricao: descricao.trim() || undefined, categoria },
      });
      onCriado();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao abrir chamado.');
    } finally { setSalvando(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <h3 className="text-sm font-semibold text-foreground">Abrir chamado</h3>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input className={inputClass} placeholder="Título *" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <select className={inputClass} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
          </select>
          <textarea
            className={`${inputClass} resize-none`}
            rows={3}
            placeholder="Descrição detalhada (opcional)"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2 self-end">
            <Button type="button" variant="outline" size="sm" onClick={onCancelar}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={salvando}>{salvando ? 'Abrindo…' : 'Abrir chamado'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Card de chamado ────────────────────────────────────────────────────────────

function CardChamado({
  chamado,
  ehGestor,
  podeAlterarStatus,
  podeExcluir,
  onAtualizado,
}: {
  chamado: Chamado;
  ehGestor: boolean;
  podeAlterarStatus: boolean;
  podeExcluir: boolean;
  onAtualizado: () => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const [alterandoStatus, setAlterandoStatus] = useState(false);
  const [mostrarDados, setMostrarDados] = useState(false);

  const proximosStatus = STATUS_TRANSICOES[chamado.status] ?? [];

  async function mudarStatus(novoStatus: string) {
    setAlterandoStatus(true);
    try {
      await apiFetch(`/chamados/${chamado.id}`, { method: 'PATCH', body: { status: novoStatus } });
      onAtualizado();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao alterar status.');
    } finally { setAlterandoStatus(false); }
  }

  async function excluir() {
    if (!confirm(`Excluir o chamado "${chamado.titulo}"?`)) return;
    try {
      await apiFetch(`/chamados/${chamado.id}`, { method: 'DELETE' });
      onAtualizado();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Cabeçalho colapsável */}
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpandido((v) => !v)}
      >
        <span className={`mt-0.5 size-2.5 shrink-0 rounded-full ${PONTO_STATUS_CHAMADO[chamado.status] ?? 'bg-muted-foreground'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{chamado.titulo}</p>
          <p className="text-xs text-muted-foreground">
            {LABEL_CATEGORIA[chamado.categoria] ?? chamado.categoria}
            {chamado.unidade && ` · Unidade ${chamado.unidade.identificador}`}
            {' · '}{chamado.abertoPor.nome}
          </p>
        </div>
        <Badge className={`shrink-0 border text-xs ${COR_STATUS_CHAMADO[chamado.status] ?? ''}`}>
          {LABEL_STATUS_CHAMADO[chamado.status] ?? chamado.status}
        </Badge>
        <span className="shrink-0 text-muted-foreground">
          {expandido ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </span>
      </button>

      {/* Detalhes */}
      {expandido && (
        <div className="border-t border-border px-4 py-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>Aberto em {formatarData(chamado.criadoEm)}</span>
            {chamado.reabertoEm && <span>Reaberto em {formatarData(chamado.reabertoEm)}</span>}
            {chamado.responsavel && <span>Responsável: {chamado.responsavel.nome}</span>}
          </div>

          {chamado.descricao && (
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{chamado.descricao}</p>
          )}

          {/* Dados da unidade — só para gestores, só se o chamado tem unidade */}
          {ehGestor && chamado.unidade?.id && (
            <div>
              <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setMostrarDados((v) => !v)}
              >
                <Info className="size-3.5" />
                {mostrarDados ? 'Ocultar dados da unidade' : 'Ver dados da unidade'}
              </button>
              {mostrarDados && (
                <div className="mt-2">
                  <PainelDadosUnidade unidadeId={chamado.unidade.id} />
                </div>
              )}
            </div>
          )}

          {ehGestor && (
            <div className="flex flex-wrap items-center gap-2">
              {podeAlterarStatus && proximosStatus.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  disabled={alterandoStatus}
                  onClick={() => mudarStatus(s)}
                >
                  {s === 'ABERTO' && chamado.status === 'RESOLVIDO' ? 'Reabrir' : `→ ${LABEL_STATUS_CHAMADO[s]}`}
                </Button>
              ))}
              {podeExcluir && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={excluir}
                  className="text-destructive hover:text-destructive ml-auto"
                >
                  <Trash2 className="size-3.5" /> Excluir
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

type FiltroStatus = 'TODOS' | 'PENDENTE_TRIAGEM' | 'ABERTO' | 'EM_ANDAMENTO' | 'RESOLVIDO';

export function ChamadosContent() {
  const vinculos = obterVinculos();
  const ehGestor = temPapel(vinculos, ['ADMINISTRADORA', 'SINDICO']);
  const { permissoes } = usePermissoesSindico();
  const { condominioId, condominios, selecionarCondominio, carregando: carregandoCond } =
    useCondominioAtivo();

  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('TODOS');
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS');
  const usuarioId = obterUsuarioId();

  async function carregar(condId: string) {
    setCarregando(true);
    setErroCarregar(null);
    try {
      const lista = await apiFetch<Chamado[]>(`/condominios/${condId}/chamados`);
      setChamados(lista);
    } catch (err: unknown) {
      setErroCarregar(err instanceof Error ? err.message : 'Não foi possível carregar os chamados.');
    } finally { setCarregando(false); }
  }

  useEffect(() => {
    if (condominioId) carregar(condominioId);
  }, [condominioId]);

  const chamadosFiltrados = chamados.filter((c) => {
    if (filtroStatus !== 'TODOS' && c.status !== filtroStatus) return false;
    if (filtroCategoria !== 'TODAS' && c.categoria !== filtroCategoria) return false;
    return true;
  });

  const contagens: Record<string, number> = {};
  for (const c of chamados) contagens[c.status] = (contagens[c.status] ?? 0) + 1;

  if (carregandoCond) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!condominioId) return <p className="text-sm text-muted-foreground">Nenhum condomínio disponível.</p>;

  return (
    <div className="flex flex-col gap-6">
      {/* Seletor de condomínio (ADM com múltiplos) */}
      {condominios.length > 1 && (
        <select
          className={inputClass}
          value={condominioId}
          onChange={(e) => selecionarCondominio(e.target.value)}
        >
          {condominios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      )}

      {/* Contadores de status */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['PENDENTE_TRIAGEM', 'ABERTO', 'EM_ANDAMENTO', 'RESOLVIDO'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFiltroStatus(filtroStatus === s ? 'TODOS' : s)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              filtroStatus === s ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/40'
            }`}
          >
            <p className={`text-lg font-display font-semibold ${filtroStatus === s ? 'text-primary' : 'text-foreground'}`}>
              {contagens[s] ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">{LABEL_STATUS_CHAMADO[s]}</p>
          </button>
        ))}
      </div>

      {/* Barra de ações */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
        >
          <option value="TODAS">Todas as categorias</option>
          {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
        </select>
        {permissoes.chamadosCriar && (
          <Button className="ml-auto" onClick={() => setMostrarForm((v) => !v)}>
            <Plus className="size-4" /> Abrir chamado
          </Button>
        )}
      </div>

      {/* Formulário de criação */}
      {mostrarForm && (
        <FormularioChamado
          condominioId={condominioId}
          onCriado={() => { setMostrarForm(false); carregar(condominioId); }}
          onCancelar={() => setMostrarForm(false)}
        />
      )}

      {/* Lista */}
      {erroCarregar && (
        <p role="alert" className="text-sm text-destructive">{erroCarregar}</p>
      )}
      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando chamados…</p>
      ) : chamadosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
          <AlertCircle className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {chamados.length === 0 ? 'Nenhum chamado registrado.' : 'Nenhum chamado com os filtros selecionados.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {chamadosFiltrados.map((c) => (
            <CardChamado
              key={c.id}
              chamado={c}
              ehGestor={ehGestor || c.abertoPorId === usuarioId}
              podeAlterarStatus={permissoes.chamadosAlterarStatus}
              podeExcluir={permissoes.chamadosExcluir}
              onAtualizado={() => carregar(condominioId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
