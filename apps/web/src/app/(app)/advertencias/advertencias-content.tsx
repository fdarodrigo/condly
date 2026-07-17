'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { obterVinculos, temPapel } from '@/lib/auth';
import { useCondominioAtivo } from '@/lib/hooks/use-condominio-ativo';
import { usePermissoesSindico } from '@/lib/hooks/use-permissoes-sindico';
import { formatarData } from '@/lib/status-labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

// ── Constantes ─────────────────────────────────────────────────────────────────

const MOTIVOS: { valor: string; label: string }[] = [
  { valor: 'BARULHO', label: 'Barulho/Perturbação' },
  { valor: 'DESCUMPRIMENTO_REGRAS', label: 'Descumprimento de regras' },
  { valor: 'DANO_PATRIMONIO', label: 'Dano ao patrimônio' },
  { valor: 'INADIMPLENCIA', label: 'Inadimplência' },
  { valor: 'CONDUTA_INADEQUADA', label: 'Conduta inadequada' },
  { valor: 'OUTRO', label: 'Outro' },
];

const LABEL_MOTIVO: Record<string, string> = Object.fromEntries(
  MOTIVOS.map((m) => [m.valor, m.label]),
);

const COR_MOTIVO: Record<string, string> = {
  BARULHO: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  DESCUMPRIMENTO_REGRAS: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  DANO_PATRIMONIO: 'bg-red-500/15 text-red-400 border-red-500/30',
  INADIMPLENCIA: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  CONDUTA_INADEQUADA: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  OUTRO: 'bg-muted/50 text-muted-foreground border-border',
};

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Advertencia {
  id: string;
  motivo: string;
  descricao: string;
  criadoEm: string;
  unidade?: { identificador: string };
  remetente: { nome: string };
  condominio?: { nome: string };
}

interface Unidade {
  id: string;
  identificador: string;
  tipo: string;
}

// ── Helper ─────────────────────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

// ── Formulário de criação (ADM / SINDICO) ──────────────────────────────────────

function FormularioAdvertencia({
  condominioId,
  unidades,
  onCriada,
  onCancelar,
}: {
  condominioId: string;
  unidades: Unidade[];
  onCriada: () => void;
  onCancelar: () => void;
}) {
  const [unidadeId, setUnidadeId] = useState('');
  const [motivo, setMotivo] = useState('BARULHO');
  const [descricao, setDescricao] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!unidadeId) { setErro('Selecione uma unidade.'); return; }
    if (!descricao.trim()) { setErro('Informe a descrição da advertência.'); return; }
    setSalvando(true); setErro('');
    try {
      await apiFetch(`/condominios/${condominioId}/advertencias`, {
        method: 'POST',
        body: { unidadeId, motivo, descricao: descricao.trim() },
      });
      setUnidadeId(''); setMotivo('BARULHO'); setDescricao('');
      onCriada();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao emitir advertência.');
    } finally { setSalvando(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <h3 className="text-sm font-semibold text-foreground">Emitir advertência</h3>
        <p className="text-xs text-muted-foreground">A advertência é enviada de forma privada para o condômino da unidade selecionada.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <select className={inputClass} value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
            <option value="">Selecionar unidade *</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>{u.identificador} — {u.tipo}</option>
            ))}
          </select>
          <select className={inputClass} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            {MOTIVOS.map((m) => <option key={m.valor} value={m.valor}>{m.label}</option>)}
          </select>
          <textarea
            className={`${inputClass} resize-none`}
            rows={4}
            placeholder="Descreva a infração ou motivo da advertência *"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2 self-end">
            <Button type="button" variant="outline" size="sm" onClick={onCancelar}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={salvando}>{salvando ? 'Enviando…' : 'Emitir advertência'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Card de advertência ────────────────────────────────────────────────────────

function CardAdvertencia({
  adv,
  ehGestor,
  onRemovida,
}: {
  adv: Advertencia;
  ehGestor: boolean;
  onRemovida: () => void;
}) {
  async function remover() {
    if (!confirm('Excluir esta advertência?')) return;
    try {
      await apiFetch(`/advertencias/${adv.id}`, { method: 'DELETE' });
      onRemovida();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3 p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-4 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge className={`border text-xs ${COR_MOTIVO[adv.motivo] ?? ''}`}>
              {LABEL_MOTIVO[adv.motivo] ?? adv.motivo}
            </Badge>
            {adv.unidade && (
              <span className="text-xs text-muted-foreground">Unidade {adv.unidade.identificador}</span>
            )}
            {adv.condominio && (
              <span className="text-xs text-muted-foreground">· {adv.condominio.nome}</span>
            )}
          </div>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{adv.descricao}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Emitida por {adv.remetente.nome} em {formatarData(adv.criadoEm)}
          </p>
        </div>
        {ehGestor && (
          <button onClick={remover} className="shrink-0 text-muted-foreground hover:text-destructive" title="Excluir">
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export function AdvertenciasContent() {
  const vinculos = obterVinculos();
  const ehGestor = temPapel(vinculos, ['ADMINISTRADORA', 'SINDICO']);
  const ehCondomino = temPapel(vinculos, ['CONDOMINO']);
  const { permissoes } = usePermissoesSindico();

  const { condominioId, condominios, selecionarCondominio, carregando: carregandoCond } =
    useCondominioAtivo();

  const [advertencias, setAdvertencias] = useState<Advertencia[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [filtroMotivo, setFiltroMotivo] = useState('TODOS');

  async function carregar() {
    if (!condominioId) return;
    setCarregando(true);
    try {
      const [advs, unids] = await Promise.all([
        ehCondomino
          ? apiFetch<Advertencia[]>('/usuarios/me/advertencias')
          : apiFetch<Advertencia[]>(`/condominios/${condominioId}/advertencias`),
        ehGestor
          ? apiFetch<Unidade[]>(`/condominios/${condominioId}/unidades`)
          : Promise.resolve([]),
      ]);
      setAdvertencias(advs);
      setUnidades(unids);
    } catch { setAdvertencias([]); } finally { setCarregando(false); }
  }

  // CONDOMINO: carrega na montagem (sem condominioId necessário pra /me)
  // Gestor: carrega quando condominioId resolve
  useEffect(() => {
    if (ehCondomino || condominioId) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominioId]);

  const filtradas = advertencias.filter(
    (a) => filtroMotivo === 'TODOS' || a.motivo === filtroMotivo,
  );

  if (carregandoCond && !ehCondomino) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="flex flex-col gap-6">
      {/* Seletor de condomínio (ADM com múltiplos) */}
      {condominios.length > 1 && (
        <select
          className={inputClass}
          value={condominioId ?? ''}
          onChange={(e) => selecionarCondominio(e.target.value)}
        >
          {condominios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      )}

      {/* Barra de ações (só gestor) */}
      {ehGestor && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            value={filtroMotivo}
            onChange={(e) => setFiltroMotivo(e.target.value)}
          >
            <option value="TODOS">Todos os motivos</option>
            {MOTIVOS.map((m) => <option key={m.valor} value={m.valor}>{m.label}</option>)}
          </select>
          {permissoes.advertenciasCriar && (
            <Button className="ml-auto" onClick={() => setMostrarForm((v) => !v)}>
              <Plus className="size-4" /> Emitir advertência
            </Button>
          )}
        </div>
      )}

      {/* Formulário */}
      {mostrarForm && condominioId && ehGestor && (
        <FormularioAdvertencia
          condominioId={condominioId}
          unidades={unidades}
          onCriada={() => { setMostrarForm(false); carregar(); }}
          onCancelar={() => setMostrarForm(false)}
        />
      )}

      {/* Cabeçalho CONDOMINO */}
      {ehCondomino && (
        <p className="text-sm text-muted-foreground">
          Advertências emitidas para sua unidade de forma particular pelo síndico ou administradora.
        </p>
      )}

      {/* Lista */}
      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
          <AlertTriangle className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {advertencias.length === 0 ? 'Nenhuma advertência registrada.' : 'Nenhuma advertência com o filtro selecionado.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtradas.map((a) => (
            <CardAdvertencia key={a.id} adv={a} ehGestor={ehGestor && permissoes.advertenciasExcluir} onRemovida={carregar} />
          ))}
        </div>
      )}
    </div>
  );
}
