'use client';

import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  MapPin,
  Settings,
  Shield,
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ApiError, apiFetch } from '@/lib/api-client';
import { obterVinculos, temPapel } from '@/lib/auth';
import { useCondominioAtivo } from '@/lib/hooks/use-condominio-ativo';
import { formatarHora } from '@/lib/status-labels';
import {
  gerarReservasMock,
  type ReservaMock,
  type TipoReservante,
} from '@/lib/mock-reservas';

interface ReservaReal {
  id: string;
  inicio: string;
  fim: string;
  status: string;
  criadoEm: string;
  areaComum: { nome: string };
  unidade: { identificador: string };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface RegrasReserva {
  horarioAbertura: string;
  horarioFechamento: string;
  duracaoMinimaMinutos: number;
  antecedenciaMaximaDias: number;
}

interface AreaComum {
  id: string;
  nome: string;
  regrasReserva?: RegrasReserva | null;
}

interface Unidade { id: string; identificador: string; }
interface Intervalo { inicio: string; fim: string; }

interface DisponibilidadeResposta {
  ocupados: Intervalo[];
  livres: Intervalo[];
  horarioAbertura?: string;
  horarioFechamento?: string;
}

interface Slot {
  inicio: string;
  fim: string;
  ocupado: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function amanha(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatarDataPtBR(ds: string): string {
  const [y, m, d] = ds.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

function formatarDataHoraLocal(iso: string): { dataStr: string; horaStr: string } {
  const d = new Date(iso);
  return {
    dataStr: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
    horaStr: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
}

/** Gera todos os slots de 1 hora entre abertura e fechamento, marcando os que colidem com ocupados. */
function gerarSlots(
  dataISO: string,
  horarioAbertura: string,
  horarioFechamento: string,
  ocupados: Intervalo[],
): Slot[] {
  const [haA, hmA] = horarioAbertura.split(':').map(Number);
  const [haF, hmF] = horarioFechamento.split(':').map(Number);
  const aberturaMins = haA * 60 + hmA;
  const fechamentoMins = haF * 60 + hmF;
  const slots: Slot[] = [];

  for (let startMins = aberturaMins; startMins + 60 <= fechamentoMins; startMins += 60) {
    const endMins = startMins + 60;
    const sh = Math.floor(startMins / 60);
    const sm = startMins % 60;
    const eh = Math.floor(endMins / 60);
    const em = endMins % 60;
    const inicioISO = `${dataISO}T${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00.000Z`;
    const fimISO = `${dataISO}T${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:00.000Z`;
    const isOcupado = ocupados.some((o) => o.inicio < fimISO && o.fim > inicioISO);
    slots.push({ inicio: inicioISO, fim: fimISO, ocupado: isOcupado });
  }

  return slots;
}

// ─── Calendar ────────────────────────────────────────────────────────────────

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function CalendarInline({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const minData = new Date(hoje.getTime() + 86400000);

  const valorInit = value ? new Date(value + 'T12:00:00') : minData;
  const [viewAno, setViewAno] = useState(valorInit.getFullYear());
  const [viewMes, setViewMes] = useState(valorInit.getMonth());

  const primeiroDia = new Date(viewAno, viewMes, 1).getDay();
  const diasNoMes = new Date(viewAno, viewMes + 1, 0).getDate();

  function navMes(delta: number) {
    const nm = viewMes + delta;
    if (nm < 0) { setViewMes(11); setViewAno(a => a - 1); }
    else if (nm > 11) { setViewMes(0); setViewAno(a => a + 1); }
    else setViewMes(nm);
  }

  function selecionarDia(dia: number) {
    const mes = String(viewMes + 1).padStart(2, '0');
    const d = String(dia).padStart(2, '0');
    const ds = `${viewAno}-${mes}-${d}`;
    if (new Date(ds + 'T00:00:00') < minData) return;
    onChange(ds);
  }

  const celulas: (number | null)[] = [
    ...Array(primeiroDia).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];
  while (celulas.length % 7 !== 0) celulas.push(null);

  return (
    <div className="rounded-xl border border-border bg-background/30 p-3" data-testid="reservas-data">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => navMes(-1)} aria-label="Mês anterior"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary">
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold">{NOMES_MES[viewMes]} {viewAno}</span>
        <button type="button" onClick={() => navMes(1)} aria-label="Próximo mês"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary">
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="py-1 text-center text-[0.6rem] font-semibold uppercase tracking-widest text-muted-foreground/50">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {celulas.map((dia, idx) => {
          if (!dia) return <div key={`vz-${idx}`} />;
          const mes = String(viewMes + 1).padStart(2, '0');
          const d = String(dia).padStart(2, '0');
          const ds = `${viewAno}-${mes}-${d}`;
          const passado = new Date(ds + 'T00:00:00') < minData;
          const selecionado = ds === value;
          const ehHoje = new Date(ds + 'T00:00:00').toDateString() === hoje.toDateString();
          return (
            <button key={dia} type="button" disabled={passado} onClick={() => selecionarDia(dia)}
              className={cn(
                'relative flex aspect-square items-center justify-center rounded-md text-sm transition-colors',
                passado && 'cursor-not-allowed text-muted-foreground/25',
                !passado && !selecionado && 'hover:bg-primary/10 hover:text-primary',
                ehHoje && !selecionado && !passado && 'font-semibold text-primary',
                selecionado && 'bg-primary font-semibold text-primary-foreground',
              )}>
              {dia}
              {ehHoje && !selecionado && (
                <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Slot grid ────────────────────────────────────────────────────────────────

/**
 * Exibe todos os slots de 1h do dia.
 * Range selection: clique num slot livre → seleciona. Clique adjacente → estende o range.
 * Clique não-adjacente → reinicia no novo slot.
 */
function SlotGrid({
  slots,
  rangeInicio,
  rangeFim,
  onClicarSlot,
}: {
  slots: Slot[];
  rangeInicio: string | null;
  rangeFim: string | null;
  onClicarSlot: (slot: Slot) => void;
}) {
  if (slots.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum slot disponível (verifique as regras da área).</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5" data-testid="lista-horarios">
      {slots.map(slot => {
        const label = `${formatarHora(slot.inicio)} – ${formatarHora(slot.fim)}`;
        const noRange = rangeInicio !== null && rangeFim !== null
          && slot.inicio >= rangeInicio && slot.fim <= rangeFim;

        if (slot.ocupado) {
          return (
            <div key={slot.inicio} data-testid="horario-reservado"
              className="flex cursor-not-allowed items-center gap-1 rounded-lg border border-destructive/20 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive/50">
              <Lock className="size-3" aria-hidden="true" /> {label}
            </div>
          );
        }

        return (
          <button key={slot.inicio} type="button" data-testid="horario-reservar"
            onClick={() => onClicarSlot(slot)}
            className={cn(
              'flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all',
              noRange
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/20',
            )}>
            <Clock className="size-3" aria-hidden="true" /> {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Custom time entry ────────────────────────────────────────────────────────

function HorarioCustom({
  data, carregando, onReservar,
}: {
  data: string;
  carregando: boolean;
  onReservar: (i: Intervalo) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');

  function submeter() {
    if (!inicio || !fim) return;
    onReservar({ inicio: `${data}T${inicio}:00.000Z`, fim: `${data}T${fim}:00.000Z` });
    setInicio('');
    setFim('');
    setAberto(false);
  }

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)}
        className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary">
        + Digitar horário personalizado
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/50 p-3">
      <span className="text-xs text-muted-foreground">De</span>
      <input type="time" value={inicio} onChange={e => setInicio(e.target.value)}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm focus:border-ring focus:outline-none" />
      <span className="text-xs text-muted-foreground">até</span>
      <input type="time" value={fim} onChange={e => setFim(e.target.value)}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm focus:border-ring focus:outline-none" />
      <Button size="sm" disabled={!inicio || !fim || carregando} onClick={submeter}>
        Reservar
      </Button>
      <button type="button" onClick={() => setAberto(false)}
        className="text-muted-foreground transition-colors hover:text-foreground">
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── Area config form (gestor only) ──────────────────────────────────────────

function ConfigAreaForm({
  areaComumId,
  regrasAtuais,
  onSalvo,
}: {
  areaComumId: string;
  regrasAtuais: RegrasReserva;
  onSalvo: (novasRegras: RegrasReserva) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [abertura, setAbertura] = useState(regrasAtuais.horarioAbertura);
  const [fechamento, setFechamento] = useState(regrasAtuais.horarioFechamento);
  const [duracao, setDuracao] = useState(String(regrasAtuais.duracaoMinimaMinutos));
  const [antecedencia, setAntecedencia] = useState(String(regrasAtuais.antecedenciaMaximaDias));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Sync when area changes
  useEffect(() => {
    setAbertura(regrasAtuais.horarioAbertura);
    setFechamento(regrasAtuais.horarioFechamento);
    setDuracao(String(regrasAtuais.duracaoMinimaMinutos));
    setAntecedencia(String(regrasAtuais.antecedenciaMaximaDias));
    setErro(null);
  }, [regrasAtuais]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const resp = await apiFetch<{ regrasReserva: RegrasReserva }>(
        `/areas-comuns/${areaComumId}/regras`,
        {
          method: 'PATCH',
          body: {
            horarioAbertura: abertura,
            horarioFechamento: fechamento,
            duracaoMinimaMinutos: Number(duracao),
            antecedenciaMaximaDias: Number(antecedencia),
          },
        },
      );
      onSalvo(resp.regrasReserva);
      setAberto(false);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  const inputClass = 'h-8 rounded-md border border-input bg-transparent px-2.5 text-sm focus:border-ring focus:outline-none w-28';

  return (
    <div className="rounded-lg border border-border bg-muted/20">
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Settings className="size-3.5" aria-hidden="true" />
        Configurações da área
        <span className="ml-auto text-muted-foreground/60">{aberto ? '▲' : '▼'}</span>
      </button>

      {aberto && (
        <form onSubmit={salvar} className="flex flex-col gap-3 border-t border-border px-3 pb-3 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Abertura</label>
              <input type="time" value={abertura} onChange={e => setAbertura(e.target.value)} className={inputClass} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Fechamento</label>
              <input type="time" value={fechamento} onChange={e => setFechamento(e.target.value)} className={inputClass} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Duração mín. (min)</label>
              <input type="number" min={15} value={duracao} onChange={e => setDuracao(e.target.value)} className={inputClass} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Antecedência máx. (dias)</label>
              <input type="number" min={1} value={antecedencia} onChange={e => setAntecedencia(e.target.value)} className={inputClass} required />
            </div>
          </div>
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2 self-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Mock helpers (painel de autorização pendente) ────────────────────────────

const TIPO_ICON: Record<TipoReservante, LucideIcon> = {
  CONDOMINO: User,
  SINDICO: Shield,
  GREMIO: Users,
};

const TIPO_CLASSES: Record<TipoReservante, string> = {
  CONDOMINO: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  SINDICO:   'bg-violet-500/15 text-violet-400 border-violet-500/30',
  GREMIO:    'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30',
};

const TIPO_LABELS: Record<TipoReservante, string> = {
  CONDOMINO: 'Condômino',
  SINDICO:   'Síndico',
  GREMIO:    'Grêmio',
};

function BadgeMock() {
  return (
    <Badge variant="outline"
      className="border-amber-500/30 bg-amber-500/10 text-[0.6rem] font-normal text-amber-400">
      Dados simulados
    </Badge>
  );
}

// ─── Condomínio selector ──────────────────────────────────────────────────────

function CondominioSelector({
  condominios, valor, onChange,
}: {
  condominios: { id: string; nome: string }[];
  valor: string;
  onChange: (id: string) => void;
}) {
  if (condominios.length <= 1) return null;
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="reservas-condominio">Condomínio</Label>
      <select id="reservas-condominio" value={valor} onChange={e => onChange(e.target.value)}
        className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        {condominios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const REGRAS_PADRAO: RegrasReserva = {
  horarioAbertura: '08:00',
  horarioFechamento: '22:00',
  duracaoMinimaMinutos: 60,
  antecedenciaMaximaDias: 30,
};

export function ReservasContent() {
  const {
    condominioId, condominios, selecionarCondominio,
    carregando: carregandoCondominio, erro: erroCondominio,
  } = useCondominioAtivo();

  const podeGerenciar = temPapel(obterVinculos(), ['ADMINISTRADORA', 'SINDICO']);
  // TODO: quando o botão de cancelar reserva for adicionado ao histórico,
  // gate ele com usePermissoesSindico().permissoes.reservasCancelar.

  // ── Form state ──
  const [areas, setAreas] = useState<AreaComum[]>([]);
  const [areaComumId, setAreaComumId] = useState('');
  const [regrasArea, setRegrasArea] = useState<RegrasReserva>(REGRAS_PADRAO);
  const [data, setData] = useState(amanha());
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeResposta | null>(null);
  // Range selection: null when nothing selected
  const [rangeInicio, setRangeInicio] = useState<string | null>(null);
  const [rangeFim, setRangeFim] = useState<string | null>(null);
  const [reservando, setReservando] = useState(false);
  const [carregandoAreas, setCarregandoAreas] = useState(false);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [unidadeIdSelecionada, setUnidadeIdSelecionada] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  // ── Histórico real ──
  const [reservasReais, setReservasReais] = useState<ReservaReal[]>([]);
  const [erroHistorico, setErroHistorico] = useState<string | null>(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [filtroHistorico, setFiltroHistorico] = useState<'recentes' | 'data'>('recentes');

  // ── Mock state ──
  const [reservasMock, setReservasMock] = useState<ReservaMock[]>([]);
  const [acoesMock, setAcoesMock] = useState<Record<string, 'CONFIRMADA' | 'NEGADA'>>({});

  async function carregarHistorico(condId: string) {
    setCarregandoHistorico(true);
    setErroHistorico(null);
    try {
      const lista = await apiFetch<ReservaReal[]>(`/condominios/${condId}/reservas`, {
        ignorarRedirecionamento401: true,
      });
      setReservasReais(lista);
    } catch (e) {
      setErroHistorico(e instanceof ApiError ? e.message : 'Não foi possível carregar o histórico.');
    } finally {
      setCarregandoHistorico(false);
    }
  }

  useEffect(() => {
    if (!condominioId) return;
    setReservasMock(gerarReservasMock(condominioId));
    setAcoesMock({});
    void carregarHistorico(condominioId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominioId]);

  useEffect(() => {
    if (!condominioId) return;
    setCarregandoAreas(true);
    setAreas([]);
    setAreaComumId('');
    setUnidades([]);
    setUnidadeIdSelecionada('');
    setDisponibilidade(null);
    setRangeInicio(null);
    setRangeFim(null);

    const promessas: Promise<void>[] = [
      apiFetch<AreaComum[]>(`/condominios/${condominioId}/areas-comuns`)
        .then(res => {
          setAreas(res);
          if (res.length > 0) {
            setAreaComumId(res[0].id);
            setRegrasArea(res[0].regrasReserva ?? REGRAS_PADRAO);
          }
        }),
    ];

    if (podeGerenciar) {
      promessas.push(
        apiFetch<Unidade[]>(`/condominios/${condominioId}/unidades`)
          .then(res => {
            setUnidades(res);
            if (res.length > 0) setUnidadeIdSelecionada(res[0].id);
          })
          .catch(() => undefined),
      );
    }

    Promise.all(promessas)
      .catch(e => setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar as áreas comuns.'))
      .finally(() => setCarregandoAreas(false));
  }, [condominioId, podeGerenciar]);

  // Update regrasArea when area changes
  useEffect(() => {
    const area = areas.find(a => a.id === areaComumId);
    if (area) setRegrasArea(area.regrasReserva ?? REGRAS_PADRAO);
  }, [areaComumId, areas]);

  useEffect(() => {
    if (!areaComumId || !data) return;
    setRangeInicio(null);
    setRangeFim(null);
    setMensagem(null);
    apiFetch<DisponibilidadeResposta>(`/areas-comuns/${areaComumId}/disponibilidade?data=${data}`)
      .then(setDisponibilidade)
      .catch(e => setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar a disponibilidade.'));
  }, [areaComumId, data]);

  function clicarSlot(slot: Slot) {
    if (slot.ocupado) return;

    if (rangeInicio === null || rangeFim === null) {
      // No selection yet — start range here
      setRangeInicio(slot.inicio);
      setRangeFim(slot.fim);
      return;
    }

    if (slot.inicio === rangeFim) {
      // Adjacent right — extend range
      setRangeFim(slot.fim);
    } else if (slot.fim === rangeInicio) {
      // Adjacent left — extend range
      setRangeInicio(slot.inicio);
    } else if (slot.inicio >= rangeInicio && slot.fim <= rangeFim) {
      // Inside range — deselect all
      setRangeInicio(null);
      setRangeFim(null);
    } else {
      // Non-adjacent free slot — reset to this slot
      setRangeInicio(slot.inicio);
      setRangeFim(slot.fim);
    }
  }

  async function confirmarReserva(intervalo: Intervalo) {
    setReservando(true);
    setErro(null);
    setMensagem(null);
    try {
      await apiFetch(`/areas-comuns/${areaComumId}/reservas`, {
        method: 'POST',
        body: {
          inicio: intervalo.inicio,
          fim: intervalo.fim,
          ...(podeGerenciar && unidadeIdSelecionada ? { unidadeId: unidadeIdSelecionada } : {}),
        },
      });
      setMensagem('Reserva confirmada!');
      setRangeInicio(null);
      setRangeFim(null);
      if (condominioId) await carregarHistorico(condominioId);
      const atualizada = await apiFetch<DisponibilidadeResposta>(
        `/areas-comuns/${areaComumId}/disponibilidade?data=${data}`,
      );
      setDisponibilidade(atualizada);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível confirmar a reserva.');
    } finally {
      setReservando(false);
    }
  }

  function reservarDiaTodo() {
    const abertura = disponibilidade?.horarioAbertura ?? regrasArea.horarioAbertura;
    const fechamento = disponibilidade?.horarioFechamento ?? regrasArea.horarioFechamento;
    confirmarReserva({
      inicio: `${data}T${abertura}:00.000Z`,
      fim: `${data}T${fechamento}:00.000Z`,
    });
  }

  function atualizarRegrasArea(novasRegras: RegrasReserva) {
    setRegrasArea(novasRegras);
    setAreas(prev => prev.map(a => a.id === areaComumId ? { ...a, regrasReserva: novasRegras } : a));
    // Reload disponibilidade with new rules
    if (areaComumId && data) {
      apiFetch<DisponibilidadeResposta>(`/areas-comuns/${areaComumId}/disponibilidade?data=${data}`)
        .then(setDisponibilidade)
        .catch(() => null);
    }
  }

  // Mock approval actions (local state only — without backend)
  function autorizarMock(id: string) { setAcoesMock(prev => ({ ...prev, [id]: 'CONFIRMADA' })); }
  function negarMock(id: string) { setAcoesMock(prev => ({ ...prev, [id]: 'NEGADA' })); }

  const pendentes = reservasMock
    .filter(r => r.status === 'PENDENTE' && !acoesMock[r.id])
    .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());

  // Compute 1-hour slots
  const horarioAbertura = disponibilidade?.horarioAbertura ?? regrasArea.horarioAbertura;
  const horarioFechamento = disponibilidade?.horarioFechamento ?? regrasArea.horarioFechamento;
  const slots = disponibilidade
    ? gerarSlots(data, horarioAbertura, horarioFechamento, disponibilidade.ocupados)
    : [];
  const diaInteiroBloqueado = slots.some(s => s.ocupado);

  const temRangeSelecionado = rangeInicio !== null && rangeFim !== null;

  // Filtra histórico de acordo com seleção: por data do calendário ou todas
  const reservasFiltradas = filtroHistorico === 'data'
    ? reservasReais.filter(r => r.inicio.startsWith(data))
    : [...reservasReais].sort((a, b) => (b.criadoEm ?? '').localeCompare(a.criadoEm ?? ''));

  // ── Early returns ──
  if (carregandoCondominio) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (erroCondominio) return <p className="text-sm text-destructive">{erroCondominio}</p>;
  if (!condominioId) return <p className="text-sm text-muted-foreground">Nenhum condomínio encontrado.</p>;

  return (
    <div className="flex flex-col gap-6">
      <CondominioSelector condominios={condominios} valor={condominioId} onChange={selecionarCondominio} />

      {/* Top grid: form + pending authorization */}
      <div className={cn('grid gap-6', podeGerenciar && 'lg:grid-cols-[1fr_380px]')}>

        {/* Card: Nova Reserva */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
              Nova Reserva
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {erro && (
              <p role="alert" className="text-sm text-destructive" data-testid="reservas-erro">{erro}</p>
            )}
            {mensagem && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400"
                data-testid="reservas-mensagem">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" /> {mensagem}
              </div>
            )}

            {carregandoAreas ? (
              <p className="text-sm text-muted-foreground">Carregando áreas…</p>
            ) : areas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma área comum cadastrada.</p>
            ) : (
              <>
                {/* Area common select */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="area-comum">Área comum</Label>
                  <select id="area-comum" data-testid="reservas-area"
                    value={areaComumId} onChange={e => setAreaComumId(e.target.value)}
                    className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm focus:border-ring focus:outline-none">
                    {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>

                {/* Unit selector for gestor */}
                {podeGerenciar && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="reserva-unidade">Unidade (reservar em nome de)</Label>
                    {unidades.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma unidade cadastrada.</p>
                    ) : (
                      <select
                        id="reserva-unidade"
                        value={unidadeIdSelecionada}
                        onChange={e => setUnidadeIdSelecionada(e.target.value)}
                        className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm focus:border-ring focus:outline-none"
                      >
                        {unidades.map(u => (
                          <option key={u.id} value={u.id}>Unidade {u.identificador}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Config form for gestor */}
                {podeGerenciar && (
                  <ConfigAreaForm
                    areaComumId={areaComumId}
                    regrasAtuais={regrasArea}
                    onSalvo={atualizarRegrasArea}
                  />
                )}

                {/* Calendar */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Data</Label>
                    {data && (
                      <span className="text-xs text-muted-foreground">{formatarDataPtBR(data)}</span>
                    )}
                  </div>
                  <CalendarInline value={data} onChange={novaData => {
                    setData(novaData);
                    setMensagem(null);
                    setErro(null);
                  }} />
                </div>

                {/* Time slots */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label>
                      Horários — {horarioAbertura} às {horarioFechamento}
                    </Label>
                    <button
                      type="button"
                      disabled={diaInteiroBloqueado || reservando}
                      onClick={reservarDiaTodo}
                      className="text-xs text-primary underline underline-offset-4 transition-colors hover:text-primary/80 disabled:cursor-not-allowed disabled:text-muted-foreground/50 disabled:no-underline"
                    >
                      Reservar dia todo
                    </button>
                  </div>

                  {!disponibilidade ? (
                    <p className="text-sm text-muted-foreground">Selecione uma área e uma data.</p>
                  ) : (
                    <SlotGrid
                      slots={slots}
                      rangeInicio={rangeInicio}
                      rangeFim={rangeFim}
                      onClicarSlot={clicarSlot}
                    />
                  )}

                  {/* Confirm bar when range is selected */}
                  {temRangeSelecionado && (
                    <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                      <div className="flex-1 text-sm">
                        <span className="font-medium text-primary">
                          {formatarHora(rangeInicio!)} – {formatarHora(rangeFim!)}
                        </span>
                        <span className="ml-2 text-muted-foreground">selecionado</span>
                      </div>
                      <Button size="sm" disabled={reservando}
                        onClick={() => confirmarReserva({ inicio: rangeInicio!, fim: rangeFim! })}
                        data-testid="confirmar-reserva">
                        <Check className="mr-1 size-3" aria-hidden="true" />
                        {reservando ? 'Confirmando…' : 'Confirmar'}
                      </Button>
                      <button type="button" onClick={() => { setRangeInicio(null); setRangeFim(null); }}
                        className="text-muted-foreground transition-colors hover:text-foreground">
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}

                  {/* Custom time entry */}
                  <HorarioCustom data={data} carregando={reservando} onReservar={confirmarReserva} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card: Aguardando Autorização (SINDICO/ADM only, mock) */}
        {podeGerenciar && (
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
                Aguardando Autorização
                <BadgeMock />
                {pendentes.length > 0 && (
                  <Badge className="ml-auto border-amber-500/30 bg-amber-500/20 text-amber-400">
                    {pendentes.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendentes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma reserva aguardando autorização.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {pendentes.map(r => {
                    const { dataStr, horaStr } = formatarDataHoraLocal(r.inicio);
                    const Icone = TIPO_ICON[r.quem.tipo];
                    return (
                      <li key={r.id}
                        className="flex flex-col gap-2 rounded-lg border border-border bg-card/50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{r.area}</span>
                            <span className="text-xs text-muted-foreground">{dataStr} às {horaStr}</span>
                          </div>
                          <Badge variant="outline"
                            className={`shrink-0 text-[0.6rem] ${TIPO_CLASSES[r.quem.tipo]}`}>
                            <Icone className="mr-1 size-2.5" aria-hidden="true" />
                            {TIPO_LABELS[r.quem.tipo]}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {r.quem.nome}{r.quem.unidade ? ` · ${r.quem.unidade}` : ''}
                        </p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => autorizarMock(r.id)}
                            className="flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/25">
                            <Check className="size-3" aria-hidden="true" /> Autorizar
                          </button>
                          <button type="button" onClick={() => negarMock(r.id)}
                            className="flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-destructive/30 bg-destructive/15 text-xs font-medium text-destructive transition-colors hover:bg-destructive/25">
                            <X className="size-3" aria-hidden="true" /> Negar
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Full-width: Histórico de Reservas (real) */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
              Histórico de Reservas
            </CardTitle>
            <div className="flex gap-1 rounded-lg border border-border bg-background/50 p-0.5">
              <button
                type="button"
                onClick={() => setFiltroHistorico('recentes')}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  filtroHistorico === 'recentes'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Mais recentes
              </button>
              <button
                type="button"
                onClick={() => setFiltroHistorico('data')}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  filtroHistorico === 'data'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Data selecionada
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {erroHistorico && (
            <p role="alert" className="mb-3 text-sm text-destructive">{erroHistorico}</p>
          )}
          {carregandoHistorico ? (
            <p className="text-sm text-muted-foreground">Carregando histórico…</p>
          ) : reservasFiltradas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {filtroHistorico === 'data'
                ? `Nenhuma reserva para ${formatarDataPtBR(data)}.`
                : 'Nenhuma reserva registrada.'}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {reservasFiltradas.map(r => {
                const inicio = new Date(r.inicio);
                const fim = new Date(r.fim);
                const dataStr = inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
                const horaInicio = inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const horaFim = fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const statusClasses: Record<string, string> = {
                  CONFIRMADA: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                  CANCELADA: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
                };
                const statusLabels: Record<string, string> = {
                  CONFIRMADA: 'Confirmada',
                  CANCELADA: 'Cancelada',
                };
                return (
                  <li key={r.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <CalendarDays className="size-4" aria-hidden="true" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{r.areaComum.nome}</span>
                        <Badge variant="outline" className={`shrink-0 text-[0.6rem] ${statusClasses[r.status] ?? ''}`}>
                          {statusLabels[r.status] ?? r.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Unidade {r.unidade.identificador} · {dataStr} · {horaInicio}–{horaFim}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
