'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  ClipboardList,
  Clock,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiFetch } from '@/lib/api-client';
import { useCondominioAtivo } from '@/lib/hooks/use-condominio-ativo';
import { usePermissoesSindico } from '@/lib/hooks/use-permissoes-sindico';
import { cn } from '@/lib/utils';

interface AcaoAdministrativa {
  id: string;
  titulo: string;
  descricao: string | null;
  realizadaEm: string;
  validoAte: string | null;
  criadoEm: string;
}

type StatusValidade = 'sem-validade' | 'valido' | 'vencendo' | 'vencido';

function calcularStatus(validoAte: string | null): StatusValidade {
  if (!validoAte) return 'sem-validade';
  const diasRestantes = Math.ceil(
    (new Date(validoAte).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (diasRestantes < 0) return 'vencido';
  if (diasRestantes <= 30) return 'vencendo';
  return 'valido';
}

function diasRestantesTexto(validoAte: string): string {
  const dias = Math.ceil((new Date(validoAte).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (dias < 0) return `Venceu há ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? 's' : ''}`;
  if (dias === 0) return 'Vence hoje';
  return `Vence em ${dias} dia${dias !== 1 ? 's' : ''}`;
}

const STATUS_CONFIG: Record<
  StatusValidade,
  { label: string; classes: string; icone: typeof CheckCircle2 }
> = {
  'sem-validade': {
    label: 'Sem validade',
    classes: 'bg-muted/50 text-muted-foreground border-border',
    icone: Clock,
  },
  valido: {
    label: 'Válido',
    classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    icone: CheckCircle2,
  },
  vencendo: {
    label: 'Vencendo',
    classes: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    icone: AlertTriangle,
  },
  vencido: {
    label: 'Vencido',
    classes: 'bg-destructive/10 text-destructive border-destructive/30',
    icone: CalendarX,
  },
};

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

// ---- Formulário ----

interface FormularioAcaoProps {
  condominioId: string;
  onCriada: (acao: AcaoAdministrativa) => void;
}

function FormularioAcao({ condominioId, onCriada }: FormularioAcaoProps) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [realizadaEm, setRealizadaEm] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [validoAte, setValidoAte] = useState('');
  const [gerarAviso, setGerarAviso] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) { setErro('Título é obrigatório.'); return; }
    setEnviando(true);
    setErro(null);
    setMensagem(null);
    try {
      const acao = await apiFetch<AcaoAdministrativa>(
        `/condominios/${condominioId}/acoes-administrativas`,
        {
          method: 'POST',
          body: {
            titulo: titulo.trim(),
            descricao: descricao.trim() || undefined,
            realizadaEm,
            validoAte: validoAte || undefined,
            gerarAviso,
          },
        },
      );
      onCriada(acao);
      setTitulo('');
      setDescricao('');
      setRealizadaEm(new Date().toISOString().slice(0, 10));
      setValidoAte('');
      setGerarAviso(false);
      setMensagem(gerarAviso ? 'Ação registrada e aviso enviado!' : 'Ação registrada.');
      setTimeout(() => setMensagem(null), 3000);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível registrar a ação.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="acao-titulo">Título *</Label>
        <Input
          id="acao-titulo"
          placeholder="Ex: Dedetização, Limpeza da piscina…"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          data-testid="acao-titulo"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="acao-descricao">Descrição</Label>
        <textarea
          id="acao-descricao"
          placeholder="Detalhes do serviço realizado…"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          data-testid="acao-descricao"
          className="min-h-16 resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="acao-realizada-em">Data de realização *</Label>
          <Input
            id="acao-realizada-em"
            type="date"
            value={realizadaEm}
            onChange={(e) => setRealizadaEm(e.target.value)}
            data-testid="acao-realizada-em"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="acao-valido-ate">Válido até</Label>
          <Input
            id="acao-valido-ate"
            type="date"
            value={validoAte}
            onChange={(e) => setValidoAte(e.target.value)}
            data-testid="acao-valido-ate"
          />
        </div>
      </div>

      {/* Opção de gerar aviso */}
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={gerarAviso}
          onChange={(e) => setGerarAviso(e.target.checked)}
          data-testid="acao-gerar-aviso"
        />
        <span
          className={cn(
            'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-input transition-colors peer-checked:border-primary peer-checked:bg-primary',
          )}
          aria-hidden="true"
        >
          {gerarAviso && <svg className="size-2.5 text-primary-foreground" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Bell className="size-3.5 text-primary" aria-hidden="true" />
            Notificar moradores via app
          </span>
          <span className="text-xs text-muted-foreground">
            Cria um aviso automático no mural do condomínio.
          </span>
        </div>
      </label>

      {erro && (
        <p role="alert" className="text-sm text-destructive" data-testid="acao-erro">
          {erro}
        </p>
      )}
      {mensagem && (
        <p className="text-sm text-primary" data-testid="acao-mensagem">
          {mensagem}
        </p>
      )}

      <Button type="submit" disabled={enviando} className="gap-1.5 self-start">
        <Plus className="size-4" aria-hidden="true" />
        {enviando ? 'Registrando…' : 'Registrar ação'}
      </Button>
    </form>
  );
}

// ---- Card de ação ----

interface CardAcaoProps {
  acao: AcaoAdministrativa;
  condominioId: string;
  podeExcluir: boolean;
  onRemovida: (id: string) => void;
}

function CardAcao({ acao, condominioId, podeExcluir, onRemovida }: CardAcaoProps) {
  const status = calcularStatus(acao.validoAte);
  const cfg = STATUS_CONFIG[status];
  const Icone = cfg.icone;
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [gerandoAviso, setGerandoAviso] = useState(false);
  const [erroCard, setErroCard] = useState<string | null>(null);

  async function excluir() {
    setExcluindo(true);
    try {
      await apiFetch(`/acoes-administrativas/${acao.id}`, { method: 'DELETE' });
      onRemovida(acao.id);
    } catch (e) {
      setErroCard(e instanceof ApiError ? e.message : 'Erro ao excluir.');
      setExcluindo(false);
      setConfirmando(false);
    }
  }

  async function gerarAvisoRenovacao() {
    setGerandoAviso(true);
    setErroCard(null);
    try {
      const validadeStr = acao.validoAte
        ? ` Validade: ${formatarData(acao.validoAte)}.`
        : '';
      await apiFetch(`/condominios/${condominioId}/avisos`, {
        method: 'POST',
        body: {
          titulo: `Renovação necessária: ${acao.titulo}`,
          corpo: `${acao.descricao ?? acao.titulo}${validadeStr} Por favor providencie a renovação.`,
          canais: ['APP'],
        },
      });
      setErroCard('Aviso de renovação enviado!');
      setTimeout(() => setErroCard(null), 3000);
    } catch (e) {
      setErroCard(e instanceof ApiError ? e.message : 'Erro ao gerar aviso.');
    } finally {
      setGerandoAviso(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{acao.titulo}</span>
          {acao.descricao && (
            <span className="text-xs text-muted-foreground">{acao.descricao}</span>
          )}
        </div>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium',
            cfg.classes,
          )}
        >
          <Icone className="size-3" aria-hidden="true" />
          {cfg.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CalendarCheck className="size-3.5" aria-hidden="true" />
          Realizado: {formatarData(acao.realizadaEm)}
        </span>
        {acao.validoAte && (
          <span
            className={cn(
              'flex items-center gap-1',
              (status === 'vencendo' || status === 'vencido') && 'font-semibold text-amber-400',
              status === 'vencido' && 'text-destructive',
            )}
          >
            <CalendarX className="size-3.5" aria-hidden="true" />
            {diasRestantesTexto(acao.validoAte)}
          </span>
        )}
      </div>

      {/* Alerta de renovação */}
      {(status === 'vencendo' || status === 'vencido') && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <span className="text-xs text-amber-400">
            {status === 'vencido' ? 'Serviço vencido — renovação urgente.' : 'Renovação próxima — notifique os moradores.'}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 border-amber-500/30 px-2 text-xs text-amber-400 hover:bg-amber-500/10"
            onClick={gerarAvisoRenovacao}
            disabled={gerandoAviso}
          >
            <Send className="size-3" aria-hidden="true" />
            {gerandoAviso ? 'Enviando…' : 'Gerar aviso'}
          </Button>
        </div>
      )}

      {erroCard && (
        <p className={cn('text-xs', erroCard.includes('enviado') ? 'text-primary' : 'text-destructive')}>
          {erroCard}
        </p>
      )}

      {/* Ações do card */}
      {podeExcluir && (
        <div className="flex justify-end gap-1 border-t border-border pt-2">
          {!confirmando ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmando(true)}
            >
              <Trash2 className="size-3" aria-hidden="true" />
              Excluir
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Confirmar exclusão?</span>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 px-2 text-xs"
                onClick={excluir}
                disabled={excluindo}
              >
                {excluindo ? 'Excluindo…' : 'Confirmar'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setConfirmando(false)}
                disabled={excluindo}
              >
                <X className="size-3" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ---- Componente principal ----

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
    <div className="flex items-center gap-2">
      <Label htmlFor="acoes-condominio">Condomínio</Label>
      <select
        id="acoes-condominio"
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

export function AcoesContent() {
  const {
    condominioId,
    condominios,
    selecionarCondominio,
    carregando: carregandoCondominio,
    erro: erroCondominio,
  } = useCondominioAtivo();
  const { permissoes } = usePermissoesSindico();

  const [acoes, setAcoes] = useState<AcaoAdministrativa[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarAcoes = useCallback(async (cId: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await apiFetch<AcaoAdministrativa[]>(
        `/condominios/${cId}/acoes-administrativas`,
      );
      setAcoes(resposta);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar as ações.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (condominioId) void carregarAcoes(condominioId);
  }, [condominioId, carregarAcoes]);

  function handleCriada(nova: AcaoAdministrativa) {
    setAcoes((atuais) => [nova, ...atuais]);
  }

  function handleRemovida(id: string) {
    setAcoes((atuais) => atuais.filter((a) => a.id !== id));
  }

  if (carregandoCondominio) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }
  if (erroCondominio) {
    return <p className="text-sm text-destructive">{erroCondominio}</p>;
  }
  if (!condominioId) {
    return <p className="text-sm text-muted-foreground">Nenhum condomínio encontrado na carteira.</p>;
  }

  // Contagens para o resumo
  const vencendo = acoes.filter((a) => calcularStatus(a.validoAte) === 'vencendo').length;
  const vencidos = acoes.filter((a) => calcularStatus(a.validoAte) === 'vencido').length;

  return (
    <div className="flex flex-col gap-4">
      <CondominioSelector
        condominios={condominios}
        valor={condominioId}
        onChange={selecionarCondominio}
      />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Formulário — só com permissão de criar */}
        {permissoes.acoesAdmCriar && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="size-4 text-muted-foreground" aria-hidden="true" />
                Registrar ação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormularioAcao condominioId={condominioId} onCriada={handleCriada} />
            </CardContent>
          </Card>
        )}

        {/* Mural */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-4 text-muted-foreground" aria-hidden="true" />
              Histórico de ações
              {acoes.length > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[0.6875rem] font-semibold text-primary-foreground">
                  {acoes.length}
                </span>
              )}
              {(vencendo > 0 || vencidos > 0) && (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.6875rem] font-medium text-amber-400">
                  <AlertTriangle className="size-3" aria-hidden="true" />
                  {vencidos > 0 ? `${vencidos} vencido${vencidos !== 1 ? 's' : ''}` : ''}
                  {vencidos > 0 && vencendo > 0 ? ', ' : ''}
                  {vencendo > 0 ? `${vencendo} vencendo` : ''}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {erro && (
              <p role="alert" className="mb-3 text-sm text-destructive">
                {erro}
              </p>
            )}
            {carregando ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : acoes.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <ClipboardList className="size-8 text-muted-foreground/40" aria-hidden="true" />
                Nenhuma ação registrada ainda.
              </div>
            ) : (
              <ul className="flex flex-col gap-3" data-testid="lista-acoes">
                {acoes.map((acao) => (
                  <CardAcao
                    key={acao.id}
                    acao={acao}
                    condominioId={condominioId}
                    podeExcluir={permissoes.acoesAdmExcluir}
                    onRemovida={handleRemovida}
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
