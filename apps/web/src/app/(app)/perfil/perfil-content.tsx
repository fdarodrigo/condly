'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Home,
  Pencil,
  Plus,
  Settings,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { obterVinculos } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface PermissoesSindico {
  podeVerFinanceiro: boolean;
  chamadosCriar: boolean;
  chamadosAlterarStatus: boolean;
  chamadosExcluir: boolean;
  avisosCriar: boolean;
  avisosEditar: boolean;
  avisosExcluir: boolean;
  enquetesCriar: boolean;
  enquetesEncerrar: boolean;
  enquetesExcluir: boolean;
  assembleiasCriar: boolean;
  assembleiasRegistrarResultados: boolean;
  assembleiasCancelar: boolean;
  assembleiasExcluir: boolean;
  advertenciasCriar: boolean;
  advertenciasExcluir: boolean;
  acoesAdmCriar: boolean;
  acoesAdmExcluir: boolean;
  reservasCancelar: boolean;
}

const PERMISSAO_LABELS: Record<keyof PermissoesSindico, string> = {
  podeVerFinanceiro: 'Ver resumo financeiro',
  chamadosCriar: 'Abrir chamados',
  chamadosAlterarStatus: 'Alterar status de chamados',
  chamadosExcluir: 'Excluir chamados',
  avisosCriar: 'Criar avisos',
  avisosEditar: 'Editar avisos',
  avisosExcluir: 'Excluir avisos',
  enquetesCriar: 'Criar enquetes',
  enquetesEncerrar: 'Encerrar enquetes',
  enquetesExcluir: 'Excluir enquetes',
  assembleiasCriar: 'Criar assembleias',
  assembleiasRegistrarResultados: 'Registrar resultados de assembleias',
  assembleiasCancelar: 'Cancelar assembleias',
  assembleiasExcluir: 'Excluir assembleias',
  advertenciasCriar: 'Emitir advertências',
  advertenciasExcluir: 'Excluir advertências',
  acoesAdmCriar: 'Registrar ações administrativas',
  acoesAdmExcluir: 'Excluir ações administrativas',
  reservasCancelar: 'Cancelar reservas de terceiros',
};

const GRUPOS_PERMISSOES: Array<{ titulo: string; chaves: (keyof PermissoesSindico)[] }> = [
  { titulo: 'Financeiro', chaves: ['podeVerFinanceiro'] },
  { titulo: 'Chamados', chaves: ['chamadosCriar', 'chamadosAlterarStatus', 'chamadosExcluir'] },
  { titulo: 'Avisos', chaves: ['avisosCriar', 'avisosEditar', 'avisosExcluir'] },
  { titulo: 'Enquetes', chaves: ['enquetesCriar', 'enquetesEncerrar', 'enquetesExcluir'] },
  { titulo: 'Assembleias', chaves: ['assembleiasCriar', 'assembleiasRegistrarResultados', 'assembleiasCancelar', 'assembleiasExcluir'] },
  { titulo: 'Advertências', chaves: ['advertenciasCriar', 'advertenciasExcluir'] },
  { titulo: 'Ações Administrativas', chaves: ['acoesAdmCriar', 'acoesAdmExcluir'] },
  { titulo: 'Reservas', chaves: ['reservasCancelar'] },
];

interface Condominio {
  id: string;
  nome: string;
  endereco: string;
  cnpj: string;
  telefone?: string | null;
  email?: string | null;
  permissoesSindico: PermissoesSindico;
}

interface Unidade {
  id: string;
  identificador: string;
  tipo: string;
  responsavelNome?: string | null;
  responsavelEmail?: string | null;
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

const STATUS_OCUPACAO_OPCOES = [
  { valor: 'PROPRIETARIO', label: 'Proprietário' },
  { valor: 'INQUILINO', label: 'Inquilino' },
  { valor: 'VAZIA', label: 'Vazia' },
];

interface Membro {
  vinculoId: string;
  usuarioId: string;
  nome: string;
  email: string;
  papel: 'SINDICO' | 'CONDOMINO';
  unidade?: { id: string; identificador: string } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

// ── Aba: Condomínios ─────────────────────────────────────────────────────────

function FormularioCondominio({
  administradoraId,
  onCriado,
}: {
  administradoraId: string;
  onCriado: () => void;
}) {
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!nome.trim() || !endereco.trim() || !cnpj.trim()) {
      setErro('Nome, endereço e CNPJ são obrigatórios.');
      return;
    }
    setCarregando(true);
    try {
      await apiFetch<Condominio>(`/administradoras/${administradoraId}/condominios`, {
        method: 'POST',
        body: { nome: nome.trim(), endereco: endereco.trim(), cnpj: cnpj.trim(), telefone: telefone.trim() || undefined, email: email.trim() || undefined },
      });
      setNome(''); setEndereco(''); setCnpj(''); setTelefone(''); setEmail('');
      onCriado();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar condomínio.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-sm font-semibold">Novo Condomínio</h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input className={inputClass} placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          <input className={inputClass} placeholder="Endereço" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          <input className={inputClass} placeholder="CNPJ" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
          <input className={inputClass} placeholder="Telefone (opcional)" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          <input className={inputClass} placeholder="E-mail (opcional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <Button type="submit" disabled={carregando} className="self-end">{carregando ? 'Salvando…' : 'Criar'}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Aba: Membros ─────────────────────────────────────────────────────────────

function FormularioMembro({
  condominioId,
  unidades,
  onCriado,
}: {
  condominioId: string;
  unidades: Unidade[];
  onCriado: () => void;
}) {
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState<'SINDICO' | 'CONDOMINO'>('CONDOMINO');
  const [unidadeId, setUnidadeId] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!email.trim()) { setErro('E-mail obrigatório.'); return; }
    if (papel === 'CONDOMINO' && !unidadeId) { setErro('Selecione uma unidade para o condômino.'); return; }
    setCarregando(true);
    try {
      await apiFetch<Membro>(`/condominios/${condominioId}/membros`, {
        method: 'POST',
        body: {
          email: email.trim(),
          nome: nome.trim() || undefined,
          senha: senha.trim() || undefined,
          papel,
          unidadeId: papel === 'CONDOMINO' ? unidadeId : undefined,
        },
      });
      setEmail(''); setNome(''); setSenha(''); setPapel('CONDOMINO'); setUnidadeId('');
      onCriado();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao adicionar membro.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-sm font-semibold">Adicionar Membro</h2>
        <p className="text-xs text-muted-foreground">Se o e-mail já existir no sistema, só o vínculo é criado.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input className={inputClass} placeholder="E-mail *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={inputClass} placeholder="Nome (obrigatório para novo usuário)" value={nome} onChange={(e) => setNome(e.target.value)} />
          <input className={inputClass} placeholder="Senha (obrigatório para novo usuário)" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <div className="flex gap-2">
            {(['CONDOMINO', 'SINDICO'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPapel(p)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${papel === p ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}
              >
                {p === 'CONDOMINO' ? 'Condômino' : 'Síndico'}
              </button>
            ))}
          </div>
          {papel === 'CONDOMINO' && (
            <select className={inputClass} value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
              <option value="">Selecionar unidade *</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>{u.identificador} — {u.tipo}</option>
              ))}
            </select>
          )}
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <Button type="submit" disabled={carregando} className="self-end">{carregando ? 'Salvando…' : 'Adicionar'}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CardMembro({ membro, condominioId, onRemovido }: { membro: Membro; condominioId: string; onRemovido: () => void }) {
  async function remover() {
    if (!confirm(`Remover ${membro.nome} (${membro.email}) do condomínio?`)) return;
    try {
      await apiFetch<null>(`/condominios/${condominioId}/membros/${membro.usuarioId}`, { method: 'DELETE' });
      onRemovido();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao remover.');
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Users className="size-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{membro.nome}</p>
        <p className="text-xs text-muted-foreground truncate">{membro.email}</p>
        {membro.unidade && (
          <p className="text-xs text-muted-foreground">Unidade {membro.unidade.identificador}</p>
        )}
      </div>
      <Badge className={`shrink-0 border text-xs ${membro.papel === 'SINDICO' ? 'bg-violet-500/15 text-violet-400 border-violet-500/30' : 'bg-blue-500/15 text-blue-400 border-blue-500/30'}`}>
        {membro.papel === 'SINDICO' ? 'Síndico' : 'Condômino'}
      </Badge>
      <button onClick={remover} className="shrink-0 text-muted-foreground hover:text-destructive" title="Remover">
        <X className="size-4" />
      </button>
    </div>
  );
}

// ── Formulário de dados complementares de uma unidade ─────────────────────────

function FormDadosUnidade({
  unidadeId,
  onSalvo,
}: {
  unidadeId: string;
  onSalvo: () => void;
}) {
  const [dados, setDados] = useState<DadosUnidade>({
    bebeRecemNascido: false, trabalhadorNoturno: false, pessoasIdosas: false,
    pets: false, petsDescricao: '', pessoasAutismo: false, pessoasAutismoDescricao: '',
    estrangeiros: false, mobilidadeReduzida: false, locacaoCurtaTemporada: false,
    statusOcupacao: 'PROPRIETARIO', veiculos: [],
    contatoEmergenciaNome: '', contatoEmergenciaTelefone: '',
  });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    apiFetch<DadosUnidade | null>(`/unidades/${unidadeId}/dados`)
      .then((d) => { if (d) setDados({ ...d, petsDescricao: d.petsDescricao ?? '', pessoasAutismoDescricao: d.pessoasAutismoDescricao ?? '', contatoEmergenciaNome: d.contatoEmergenciaNome ?? '', contatoEmergenciaTelefone: d.contatoEmergenciaTelefone ?? '' }); })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [unidadeId]);

  function setFlag(campo: keyof DadosUnidade, valor: boolean) {
    setDados((prev) => ({ ...prev, [campo]: valor }));
  }

  function addVeiculo() {
    setDados((prev) => ({ ...prev, veiculos: [...prev.veiculos, { placa: '', modelo: '', cor: '' }] }));
  }

  function removeVeiculo(i: number) {
    setDados((prev) => ({ ...prev, veiculos: prev.veiculos.filter((_, idx) => idx !== i) }));
  }

  function setVeiculo(i: number, campo: keyof Veiculo, valor: string) {
    setDados((prev) => ({
      ...prev,
      veiculos: prev.veiculos.map((v, idx) => idx === i ? { ...v, [campo]: valor } : v),
    }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true); setErro('');
    try {
      await apiFetch(`/unidades/${unidadeId}/dados`, {
        method: 'PUT',
        body: {
          ...dados,
          petsDescricao: dados.petsDescricao || null,
          pessoasAutismoDescricao: dados.pessoasAutismoDescricao || null,
          contatoEmergenciaNome: dados.contatoEmergenciaNome || null,
          contatoEmergenciaTelefone: dados.contatoEmergenciaTelefone || null,
        },
      });
      onSalvo();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally { setSalvando(false); }
  }

  function Toggle({ campo, label }: { campo: keyof DadosUnidade; label: string }) {
    const ativo = dados[campo] as boolean;
    return (
      <label className="flex cursor-pointer items-center gap-3">
        <div onClick={() => setFlag(campo, !ativo)} className={`relative h-5 w-9 rounded-full transition-colors ${ativo ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
          <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${ativo ? 'translate-x-4' : ''}`} />
        </div>
        <span className="text-sm text-foreground">{label}</span>
      </label>
    );
  }

  if (carregando) return <p className="text-xs text-muted-foreground py-2">Carregando…</p>;

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4 rounded-lg border border-border/60 bg-muted/10 p-4 mt-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Perfil habitacional</p>

      {/* Status de ocupação */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Status de ocupação</label>
        <select
          className={inputClass}
          value={dados.statusOcupacao}
          onChange={(e) => setDados((prev) => ({ ...prev, statusOcupacao: e.target.value }))}
        >
          {STATUS_OCUPACAO_OPCOES.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
        </select>
      </div>

      {/* Flags booleanas */}
      <div className="flex flex-col gap-2">
        <Toggle campo="bebeRecemNascido" label="Bebê recém-nascido" />
        <Toggle campo="trabalhadorNoturno" label="Trabalhador noturno" />
        <Toggle campo="pessoasIdosas" label="Pessoas idosas" />
        <Toggle campo="estrangeiros" label="Estrangeiros" />
        <Toggle campo="mobilidadeReduzida" label="Mobilidade reduzida (cadeirantes, acamados)" />
        <Toggle campo="locacaoCurtaTemporada" label="Locação de curta temporada / Airbnb" />

        <Toggle campo="pets" label="Pets" />
        {dados.pets && (
          <input className={inputClass} placeholder="Especificar pets (opcional)" value={dados.petsDescricao ?? ''} onChange={(e) => setDados((prev) => ({ ...prev, petsDescricao: e.target.value }))} />
        )}

        <Toggle campo="pessoasAutismo" label="Autismo ou deficiência comportamental" />
        {dados.pessoasAutismo && (
          <input className={inputClass} placeholder="Grau / detalhes (opcional)" value={dados.pessoasAutismoDescricao ?? ''} onChange={(e) => setDados((prev) => ({ ...prev, pessoasAutismoDescricao: e.target.value }))} />
        )}
      </div>

      {/* Veículos */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Veículos da unidade</p>
          <button type="button" onClick={addVeiculo} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus className="size-3" /> Adicionar
          </button>
        </div>
        {dados.veiculos.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhum veículo.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {dados.veiculos.map((v, i) => (
              <div key={i} className="grid grid-cols-3 gap-1.5 items-center">
                <input className={inputClass} placeholder="Placa" value={v.placa} onChange={(e) => setVeiculo(i, 'placa', e.target.value)} />
                <input className={inputClass} placeholder="Modelo" value={v.modelo} onChange={(e) => setVeiculo(i, 'modelo', e.target.value)} />
                <div className="flex gap-1">
                  <input className={inputClass} placeholder="Cor" value={v.cor} onChange={(e) => setVeiculo(i, 'cor', e.target.value)} />
                  <button type="button" onClick={() => removeVeiculo(i)} className="shrink-0 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contato de emergência */}
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Contato de emergência externo</p>
        <div className="grid grid-cols-2 gap-2">
          <input className={inputClass} placeholder="Nome" value={dados.contatoEmergenciaNome ?? ''} onChange={(e) => setDados((prev) => ({ ...prev, contatoEmergenciaNome: e.target.value }))} />
          <input className={inputClass} placeholder="Telefone" value={dados.contatoEmergenciaTelefone ?? ''} onChange={(e) => setDados((prev) => ({ ...prev, contatoEmergenciaTelefone: e.target.value }))} />
        </div>
      </div>

      {erro && <p className="text-xs text-destructive">{erro}</p>}
      <Button type="submit" size="sm" className="self-end" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar dados'}</Button>
    </form>
  );
}

// ── Aba: Unidades ─────────────────────────────────────────────────────────────

function AbaUnidades({ condominioId }: { condominioId: string }) {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [identificador, setIdentificador] = useState('');
  const [tipo, setTipo] = useState('APARTAMENTO');
  const [respNome, setRespNome] = useState('');
  const [respEmail, setRespEmail] = useState('');
  const [erro, setErro] = useState('');
  const [expandidaId, setExpandidaId] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      const lista = await apiFetch<Unidade[]>(`/condominios/${condominioId}/unidades`);
      setUnidades(lista);
    } catch { setUnidades([]); } finally { setCarregando(false); }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [condominioId]);

  async function criarUnidade(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!identificador.trim()) { setErro('Identificador obrigatório.'); return; }
    try {
      const nova = await apiFetch<Unidade>(`/condominios/${condominioId}/unidades`, {
        method: 'POST',
        body: { identificador: identificador.trim(), tipo, responsavelNome: respNome.trim() || undefined, responsavelEmail: respEmail.trim() || undefined },
      });
      setIdentificador(''); setTipo('APARTAMENTO'); setRespNome(''); setRespEmail('');
      setMostrarForm(false);
      // Auto-expande a unidade recém-criada para o formulário de dados aparecer imediatamente.
      setExpandidaId(nova.id);
      carregar();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar unidade.');
    }
  }

  async function excluirUnidade(id: string) {
    if (!confirm('Excluir unidade? Só possível sem usuários vinculados.')) return;
    try {
      await apiFetch<null>(`/unidades/${id}`, { method: 'DELETE' });
      if (expandidaId === id) setExpandidaId(null);
      carregar();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{unidades.length} unidade{unidades.length !== 1 ? 's' : ''}</p>
        <Button size="sm" variant="outline" onClick={() => setMostrarForm((v) => !v)}>
          <Plus className="size-3.5" /> Nova unidade
        </Button>
      </div>

      {mostrarForm && (
        <form onSubmit={criarUnidade} className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <input className={inputClass} placeholder="Identificador (ex: 101)" value={identificador} onChange={(e) => setIdentificador(e.target.value)} />
            <select className={inputClass} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="APARTAMENTO">Apartamento</option>
              <option value="CASA">Casa</option>
              <option value="SALA_COMERCIAL">Sala Comercial</option>
              <option value="VAGA">Vaga</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>
          <input className={inputClass} placeholder="Nome do responsável (opcional)" value={respNome} onChange={(e) => setRespNome(e.target.value)} />
          <input className={inputClass} placeholder="E-mail do responsável (opcional)" value={respEmail} onChange={(e) => setRespEmail(e.target.value)} />
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2 self-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setMostrarForm(false)}>Cancelar</Button>
            <Button type="submit" size="sm">Criar</Button>
          </div>
        </form>
      )}

      {carregando ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : unidades.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma unidade cadastrada.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {unidades.map((u) => (
            <div key={u.id} className="rounded-lg border border-border bg-background/50">
              <div className="flex items-center gap-2 px-3 py-2">
                <Home className="size-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">{u.identificador}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{u.tipo}</span>
                  {u.responsavelNome && <span className="ml-2 text-xs text-muted-foreground">— {u.responsavelNome}</span>}
                </div>
                <button
                  onClick={() => setExpandidaId(expandidaId === u.id ? null : u.id)}
                  className="shrink-0 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  title="Dados complementares"
                >
                  {expandidaId === u.id ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                </button>
                <button onClick={() => excluirUnidade(u.id)} className="shrink-0 text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              {expandidaId === u.id && (
                <div className="px-3 pb-3">
                  <FormDadosUnidade unidadeId={u.id} onSalvo={() => {}} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card de condomínio expandido com abas ─────────────────────────────────────

type AbaCondominio = 'dados' | 'membros' | 'unidades';

function CardCondominioCompleto({
  cond,
  ehAdministradora,
  onAtualizado,
}: {
  cond: Condominio;
  administradoraId?: string;
  /** SINDICO vê/faz quase tudo, exceto: excluir o condomínio e editar as
   *  próprias permissões (o backend também rejeita — aqui é só UX). */
  ehAdministradora: boolean;
  onAtualizado: () => void;
}) {
  const [aba, setAba] = useState<AbaCondominio>('dados');
  const [expandido, setExpandido] = useState(false);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [carregandoMembros, setCarregandoMembros] = useState(false);

  async function carregarMembros() {
    setCarregandoMembros(true);
    try {
      const [m, u] = await Promise.all([
        apiFetch<Membro[]>(`/condominios/${cond.id}/membros`),
        apiFetch<Unidade[]>(`/condominios/${cond.id}/unidades`),
      ]);
      setMembros(m);
      setUnidades(u);
    } catch { setMembros([]); } finally { setCarregandoMembros(false); }
  }

  function abrir(novaAba: AbaCondominio) {
    setAba(novaAba);
    if (!expandido) setExpandido(true);
    if (novaAba === 'membros' && membros.length === 0) carregarMembros();
  }

  // ── Edição ──────────────────────────────────────────────────────────────────
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(cond.nome);
  const [endereco, setEndereco] = useState(cond.endereco);
  const [telefone, setTelefone] = useState(cond.telefone ?? '');
  const [email, setEmail] = useState(cond.email ?? '');
  const PERMS_PADRAO: PermissoesSindico = {
    podeVerFinanceiro: true, chamadosCriar: true, chamadosAlterarStatus: true, chamadosExcluir: true,
    avisosCriar: true, avisosEditar: true, avisosExcluir: true,
    enquetesCriar: true, enquetesEncerrar: true, enquetesExcluir: true,
    assembleiasCriar: true, assembleiasRegistrarResultados: true, assembleiasCancelar: true, assembleiasExcluir: true,
    advertenciasCriar: true, advertenciasExcluir: true,
    acoesAdmCriar: true, acoesAdmExcluir: true, reservasCancelar: true,
  };
  const [perms, setPerms] = useState<PermissoesSindico>({ ...PERMS_PADRAO, ...cond.permissoesSindico });
  const [salvando, setSalvando] = useState(false);
  const [erroEdit, setErroEdit] = useState('');

  function togglePerm(chave: keyof PermissoesSindico) {
    setPerms((prev) => ({ ...prev, [chave]: !prev[chave] }));
  }

  async function salvar() {
    setSalvando(true); setErroEdit('');
    try {
      await apiFetch<Condominio>(`/condominios/${cond.id}`, {
        method: 'PATCH',
        body: {
          nome,
          endereco,
          telefone: telefone || null,
          email: email || null,
          // SINDICO nunca envia permissoesSindico — o backend rejeita com 403
          // pra impedir que ele desbloqueie as próprias restrições.
          ...(ehAdministradora && { permissoesSindico: perms }),
        },
      });
      setEditando(false);
      onAtualizado();
    } catch (err: unknown) {
      setErroEdit(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally { setSalvando(false); }
  }

  async function excluir() {
    if (!confirm(`Excluir "${cond.nome}"? Só possível sem usuários vinculados.`)) return;
    try {
      await apiFetch<null>(`/condominios/${cond.id}`, { method: 'DELETE' });
      onAtualizado();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  }

  const ABAS: { id: AbaCondominio; label: string }[] = [
    { id: 'dados', label: 'Dados & Permissões' },
    { id: 'membros', label: 'Membros' },
    { id: 'unidades', label: 'Unidades' },
  ];

  return (
    <Card>
      <CardContent className="pt-4">
        {/* Cabeçalho */}
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="size-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{cond.nome}</p>
            <p className="text-xs text-muted-foreground">{cond.cnpj}</p>
            <p className="text-xs text-muted-foreground truncate">{cond.endereco}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={() => abrir('dados')} className="text-muted-foreground hover:text-primary" title="Dados">
              <Settings className="size-4" />
            </button>
            <button onClick={() => abrir('membros')} className="text-muted-foreground hover:text-primary" title="Membros">
              <Users className="size-4" />
            </button>
            <button onClick={() => abrir('unidades')} className="text-muted-foreground hover:text-primary" title="Unidades">
              <Home className="size-4" />
            </button>
            {ehAdministradora && (
              <button onClick={excluir} className="text-muted-foreground hover:text-destructive" title="Excluir">
                <Trash2 className="size-4" />
              </button>
            )}
            <button onClick={() => setExpandido((v) => !v)} className="text-muted-foreground hover:text-foreground">
              {expandido ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
            </button>
          </div>
        </div>

        {/* Conteúdo expandido com abas */}
        {expandido && (
          <div className="mt-4 border-t border-border pt-4">
            {/* Navegação de abas */}
            <div className="mb-4 flex gap-0.5 rounded-lg bg-muted p-0.5">
              {ABAS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setAba(a.id); if (a.id === 'membros' && membros.length === 0) carregarMembros(); }}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${aba === a.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {a.label}
                </button>
              ))}
            </div>

            {/* Aba: Dados & Permissões */}
            {aba === 'dados' && (
              <div className="flex flex-col gap-3">
                {editando ? (
                  <>
                    <input className={inputClass} placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
                    <input className={inputClass} placeholder="Endereço" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
                    <input className={inputClass} placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
                    <input className={inputClass} placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />

                    {/* Toggles de permissão: só a ADMINISTRADORA edita — pro
                        síndico as permissões ficam visíveis apenas no modo de
                        leitura (abaixo), nunca editáveis por ele mesmo. */}
                    {ehAdministradora && (
                      <>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Permissões do Síndico</p>
                        <div className="flex flex-col gap-4">
                          {GRUPOS_PERMISSOES.map((grupo) => (
                            <div key={grupo.titulo} className="flex flex-col gap-1.5">
                              <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground/70">{grupo.titulo}</p>
                              {grupo.chaves.map((chave) => (
                                <label key={chave} className="flex cursor-pointer items-center gap-3">
                                  <div
                                    onClick={() => togglePerm(chave)}
                                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${perms[chave] ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                                  >
                                    <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${perms[chave] ? 'translate-x-4' : ''}`} />
                                  </div>
                                  <span className="text-sm text-foreground">{PERMISSAO_LABELS[chave]}</span>
                                </label>
                              ))}
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {erroEdit && <p className="text-xs text-destructive">{erroEdit}</p>}
                    <div className="flex gap-2 self-end">
                      <Button variant="outline" size="sm" onClick={() => setEditando(false)}>Cancelar</Button>
                      <Button size="sm" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      {cond.telefone && <p className="text-xs text-muted-foreground">Tel: {cond.telefone}</p>}
                      {cond.email && <p className="text-xs text-muted-foreground">E-mail: {cond.email}</p>}
                    </div>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Permissões do Síndico</p>
                    <div className="flex flex-col gap-3">
                      {GRUPOS_PERMISSOES.map((grupo) => {
                        const bloqueadas = grupo.chaves.filter((c) => cond.permissoesSindico[c] === false);
                        return (
                          <div key={grupo.titulo}>
                            <p className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground/70">{grupo.titulo}</p>
                            <div className="flex flex-col gap-1">
                              {grupo.chaves.map((chave) => {
                                const permitido = cond.permissoesSindico[chave] !== false;
                                return (
                                  <div key={chave} className="flex items-center gap-2">
                                    <span className={`size-2 shrink-0 rounded-full ${permitido ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                    <span className="text-sm text-foreground">{PERMISSAO_LABELS[chave]}</span>
                                    {!permitido && (
                                      <span className="text-xs text-rose-400">Bloqueado</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {bloqueadas.length === 0 && (
                              <p className="mt-0.5 text-xs text-emerald-400/70">Todas as ações permitidas</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setEditando(true)} className="self-start mt-1">
                      <Pencil className="size-3.5" /> Editar
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Aba: Membros */}
            {aba === 'membros' && (
              <div className="flex flex-col gap-4">
                <FormularioMembro condominioId={cond.id} unidades={unidades} onCriado={carregarMembros} />
                {carregandoMembros ? (
                  <p className="text-xs text-muted-foreground">Carregando membros…</p>
                ) : membros.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum membro vinculado.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {membros.map((m) => (
                      <CardMembro key={m.vinculoId} membro={m} condominioId={cond.id} onRemovido={carregarMembros} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Aba: Unidades */}
            {aba === 'unidades' && <AbaUnidades condominioId={cond.id} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Componente raiz ───────────────────────────────────────────────────────────

export function PerfilContent() {
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [administradoraId, setAdministradoraId] = useState('');
  // SINDICO: mesmo card completo da ADM (dados, membros, unidades), só que
  // apenas do condomínio dele — sem criar/excluir condomínio nem editar as
  // próprias permissões.
  const [condominioSindicoId, setCondominioSindicoId] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [mostrarFormNovo, setMostrarFormNovo] = useState(false);

  useEffect(() => {
    const vinculos = obterVinculos();
    const admId = vinculos.find((v) => v.papel === 'ADMINISTRADORA')?.administradoraId;
    if (admId) {
      setAdministradoraId(admId);
      carregarCondominios(admId);
      return;
    }
    const condId = vinculos.find((v) => v.papel === 'SINDICO' && v.condominioId)?.condominioId;
    if (condId) {
      setCondominioSindicoId(condId);
      carregarCondominioUnico(condId);
      return;
    }
    setCarregando(false);
  }, []);

  async function carregarCondominios(admId: string) {
    setCarregando(true);
    try {
      // GET /administradoras/:id/condominios retorna {id, nome} — buscamos os
      // detalhes completos de cada um via GET /condominios/:id.
      const resumos = await apiFetch<{ id: string; nome: string }[]>(`/administradoras/${admId}/condominios`);
      const detalhes = await Promise.all(
        resumos.map((r) => apiFetch<Condominio>(`/condominios/${r.id}`)),
      );
      setCondominios(detalhes);
    } catch { setCondominios([]); } finally { setCarregando(false); }
  }

  async function carregarCondominioUnico(condId: string) {
    setCarregando(true);
    try {
      setCondominios([await apiFetch<Condominio>(`/condominios/${condId}`)]);
    } catch { setCondominios([]); } finally { setCarregando(false); }
  }

  const ehAdministradora = Boolean(administradoraId);
  const ehSindico = Boolean(condominioSindicoId);

  function recarregar() {
    if (ehAdministradora) carregarCondominios(administradoraId);
    else if (ehSindico) carregarCondominioUnico(condominioSindicoId);
  }

  if (!ehAdministradora && !ehSindico && !carregando) {
    return (
      <p className="text-sm text-muted-foreground">
        O painel de gestão do perfil está disponível para síndicos e administradoras.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {ehAdministradora ? 'Condomínios da carteira' : 'Meu condomínio'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {ehAdministradora
              ? `${condominios.length} condomínio${condominios.length !== 1 ? 's' : ''}`
              : 'Dados, membros e unidades do condomínio sob sua gestão'}
          </p>
        </div>
        {ehAdministradora && (
          <Button onClick={() => setMostrarFormNovo((v) => !v)}>
            <Plus className="size-4" />
            Novo Condomínio
          </Button>
        )}
      </div>

      {mostrarFormNovo && ehAdministradora && (
        <FormularioCondominio
          administradoraId={administradoraId}
          onCriado={() => { setMostrarFormNovo(false); carregarCondominios(administradoraId); }}
        />
      )}

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : condominios.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
          <Building2 className="size-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhum condomínio cadastrado ainda.</p>
          {ehAdministradora && (
            <p className="text-xs text-muted-foreground/70">Clique em &quot;Novo Condomínio&quot; para começar.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {condominios.map((c) => (
            <CardCondominioCompleto
              key={c.id}
              cond={c}
              administradoraId={administradoraId || undefined}
              ehAdministradora={ehAdministradora}
              onAtualizado={recarregar}
            />
          ))}
        </div>
      )}
    </div>
  );
}
