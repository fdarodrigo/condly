import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from '../test/helpers/cleanup-database';
import { Administradora, Condominio, Unidade, Usuario } from '../generated/prisma/client';

export const SENHA_DEMO = 'Demo123!';

// Cada condomínio ganha 1 síndico e até este número de condôminos (limitado
// pela quantidade de unidades — Villagio Toscana tem só 8 unidades, então
// recebe 8 condôminos).
export const MAX_CONDOMINOS_POR_CONDOMINIO = 10;

function valorCondominial(indice: number, base: number): number {
  return base + (indice % 4) * 25;
}

function cpfFicticio(indice: number): string {
  const sufixo = String(indice + 1).padStart(2, '0');
  return `529.982.${sufixo}7-25`;
}

// ─── Definição dos 10 condomínios de demonstração ────────────────────────────
// Cada item determina: nome, endereço, CNPJ, quantidade de unidades e taxa
// de adimplência aproximada — a distribuição de status é gerada automaticamente
// abaixo, proporcional ao percentual adimplente configurado.

export const CONDOMINIOS_CONFIG = [
  { nome: 'Residencial Ipê Verde',      endereco: 'Rua das Acácias, 12',       cnpj: '00.000.001/0001-01', unidades: 12, baseCondominial: 480, adimplencia: 1.00 },
  { nome: 'Edifício Maracanã',          endereco: 'Av. Maracanã, 340',          cnpj: '00.000.002/0001-02', unidades: 18, baseCondominial: 520, adimplencia: 0.83 },
  { nome: 'Condomínio Solar das Pedras',endereco: 'Rua Pedra Negra, 88',        cnpj: '00.000.003/0001-03', unidades: 24, baseCondominial: 450, adimplencia: 0.75 },
  { nome: 'Torres do Parque',           endereco: 'Av. das Palmeiras, 1200',    cnpj: '00.000.004/0001-04', unidades: 30, baseCondominial: 650, adimplencia: 0.90 },
  { nome: 'Villagio Toscana',           endereco: 'Rua Toscana, 55',            cnpj: '00.000.005/0001-05', unidades: 8,  baseCondominial: 750, adimplencia: 1.00 },
  { nome: 'Residencial Bela Vista',     endereco: 'Rua Bela Vista, 210',        cnpj: '00.000.006/0001-06', unidades: 16, baseCondominial: 490, adimplencia: 0.62 },
  { nome: 'Edifício Copacabana Club',   endereco: 'Av. Atlântica, 777',         cnpj: '00.000.007/0001-07', unidades: 20, baseCondominial: 900, adimplencia: 0.95 },
  { nome: 'Condomínio Rio Branco',      endereco: 'Av. Rio Branco, 444',        cnpj: '00.000.008/0001-08', unidades: 14, baseCondominial: 560, adimplencia: 0.71 },
  { nome: 'Residencial Alegria',        endereco: 'Rua da Alegria, 30',         cnpj: '00.000.009/0001-09', unidades: 10, baseCondominial: 420, adimplencia: 0.80 },
  { nome: 'Boulevard Jardins',          endereco: 'Rua Alameda dos Jardins, 9', cnpj: '00.000.010/0001-10', unidades: 22, baseCondominial: 580, adimplencia: 0.86 },
] as const;

// Serviços periódicos por condomínio (índice da lista acima)
const SERVICOS_PERIODICOS: { condominioIdx: number; nome: string; diasDoHoje: number }[] = [
  { condominioIdx: 0, nome: 'Limpeza caixa d\'água', diasDoHoje: 5 },
  { condominioIdx: 0, nome: 'Dedetização', diasDoHoje: 18 },
  { condominioIdx: 1, nome: 'Laudo técnico do gerador', diasDoHoje: 7 },
  { condominioIdx: 2, nome: 'Limpeza da piscina', diasDoHoje: 3 },
  { condominioIdx: 2, nome: 'Manutenção dos extintores', diasDoHoje: 25 },
  { condominioIdx: 3, nome: 'Renovação do seguro predial', diasDoHoje: 12 },
  { condominioIdx: 4, nome: 'Mandato do síndico', diasDoHoje: 28 },
  { condominioIdx: 5, nome: 'Dedetização', diasDoHoje: 9 },
  { condominioIdx: 6, nome: 'Vistoria do AVCB', diasDoHoje: 20 },
  { condominioIdx: 7, nome: 'Limpeza caixa d\'água', diasDoHoje: 15 },
  { condominioIdx: 8, nome: 'Renovação contrato de elevadores', diasDoHoje: 6 },
  { condominioIdx: 9, nome: 'Laudo da fachada', diasDoHoje: 22 },
];

// Chamados de demonstração por condomínio (índice). Quando
// `abertoPorCondominoIdx` está presente, o chamado é aberto pelo condômino
// daquele índice (e recebe a unidade dele); caso contrário é aberto pelo
// síndico do próprio condomínio.
const CHAMADOS_CONFIG: {
  condominioIdx: number;
  titulo: string;
  categoria: string;
  status: string;
  abertoPorCondominoIdx?: number;
}[] = [
  { condominioIdx: 0, titulo: 'Vazamento no banheiro', categoria: 'VAZAMENTO', status: 'ABERTO' },
  { condominioIdx: 0, titulo: 'Infiltração no teto do banheiro', categoria: 'VAZAMENTO', status: 'PENDENTE_TRIAGEM', abertoPorCondominoIdx: 0 },
  { condominioIdx: 0, titulo: 'Lâmpada queimada na garagem', categoria: 'ILUMINACAO', status: 'RESOLVIDO', abertoPorCondominoIdx: 1 },
  { condominioIdx: 1, titulo: 'Elevador com ruído estranho', categoria: 'ELEVADOR', status: 'EM_ANDAMENTO' },
  { condominioIdx: 1, titulo: 'Iluminação do estacionamento queimada', categoria: 'ILUMINACAO', status: 'PENDENTE_TRIAGEM' },
  { condominioIdx: 2, titulo: 'Portão da garagem com defeito', categoria: 'PORTARIA', status: 'ABERTO' },
  { condominioIdx: 2, titulo: 'Infiltração na cobertura', categoria: 'VAZAMENTO', status: 'EM_ANDAMENTO' },
  { condominioIdx: 2, titulo: 'Lâmpada queimada no hall', categoria: 'ILUMINACAO', status: 'RESOLVIDO' },
  { condominioIdx: 3, titulo: 'Barulho excessivo no 5A', categoria: 'BARULHO', status: 'ABERTO' },
  { condominioIdx: 4, titulo: 'Ar-condicionado da área comum com defeito', categoria: 'AREA_COMUM', status: 'EM_ANDAMENTO' },
  { condominioIdx: 5, titulo: 'Goteira no telhado do bloco B', categoria: 'VAZAMENTO', status: 'ABERTO' },
  { condominioIdx: 5, titulo: 'Vazamento no jardim', categoria: 'VAZAMENTO', status: 'ABERTO' },
  { condominioIdx: 5, titulo: 'Interfone sem funcionar na entrada', categoria: 'PORTARIA', status: 'PENDENTE_TRIAGEM' },
  { condominioIdx: 6, titulo: 'Manutenção da piscina', categoria: 'AREA_COMUM', status: 'RESOLVIDO' },
  { condominioIdx: 7, titulo: 'Portaria sem câmera de segurança', categoria: 'SEGURANCA', status: 'ABERTO' },
  { condominioIdx: 7, titulo: 'Desentupimento de calha', categoria: 'MANUTENCAO', status: 'EM_ANDAMENTO' },
  { condominioIdx: 8, titulo: 'Calçada com buraco na entrada', categoria: 'MANUTENCAO', status: 'ABERTO' },
  { condominioIdx: 9, titulo: 'Pintura da fachada deteriorada', categoria: 'MANUTENCAO', status: 'PENDENTE_TRIAGEM' },
  { condominioIdx: 9, titulo: 'Corrimão solto na escada', categoria: 'SEGURANCA', status: 'ABERTO' },
];

// ─── Identidade dos usuários de demonstração ─────────────────────────────────
// Os 5 e-mails originais do seed (administradora, sindico, condomino1..3)
// permanecem exatamente os mesmos — quem já tinha credencial anotada continua
// logando. Os novos seguem um padrão previsível por condomínio:
//   síndico do condomínio N (1-based):  sindico{N}.demo@condly.app
//   condômino J do condomínio N:        condomino{J}.c{N}.demo@condly.app
// (no condomínio 1, condôminos ficam sem o sufixo ".c1": condomino{J}.demo)

export function emailSindico(condominioIdx: number): string {
  return condominioIdx === 0
    ? 'sindico.demo@condly.app'
    : `sindico${condominioIdx + 1}.demo@condly.app`;
}

export function emailCondomino(condominioIdx: number, condominoIdx: number): string {
  return condominioIdx === 0
    ? `condomino${condominoIdx + 1}.demo@condly.app`
    : `condomino${condominoIdx + 1}.c${condominioIdx + 1}.demo@condly.app`;
}

const NOMES_SINDICOS = [
  'Sérgio Síndico',
  'Beatriz Ramos',
  'Otávio Nunes',
  'Marina Duarte',
  'Ricardo Toledo',
  'Fernanda Vieira',
  'Paulo Siqueira',
  'Luciana Prado',
  'André Bastos',
  'Cristina Falcão',
];

const PRIMEIROS_NOMES = [
  'Aline', 'Bruno', 'Camila', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Hugo',
  'Isabela', 'João', 'Karen', 'Leonardo', 'Mariana', 'Nelson', 'Olívia',
  'Pedro', 'Quésia', 'Rafael', 'Sofia', 'Tiago',
];

const SOBRENOMES = [
  'Almeida', 'Barbosa', 'Cardoso', 'Dias', 'Esteves', 'Ferreira', 'Gomes',
  'Henriques', 'Ibrahim', 'Justino', 'Klein', 'Lima', 'Moraes', 'Nogueira',
  'Oliveira', 'Pereira',
];

function nomeCondomino(condominioIdx: number, condominoIdx: number): string {
  // Os 3 primeiros condôminos do primeiro condomínio mantêm os nomes originais
  const nomesOriginais = ['Carla Condômina', 'Caio Condômino', 'Cíntia Condômina'];
  if (condominioIdx === 0 && condominoIdx < 3) return nomesOriginais[condominoIdx];
  const primeiro = PRIMEIROS_NOMES[(condominioIdx * 7 + condominoIdx) % PRIMEIROS_NOMES.length];
  const sobrenome = SOBRENOMES[(condominioIdx * 3 + condominoIdx) % SOBRENOMES.length];
  return `${primeiro} ${sobrenome}`;
}

export function quantidadeCondominos(unidadesDoCondominio: number): number {
  return Math.min(MAX_CONDOMINOS_POR_CONDOMINIO, unidadesDoCondominio);
}

// ─── Distribuição de status de cobrança ──────────────────────────────────────
// Pura e exportada: usada tanto pela criação das cobranças quanto pelo smoke
// test de contagens (scripts/verify-seed-counts.ts), pra que os totais por
// status nunca precisem ser recontados à mão quando a configuração mudar.

export function distribuirStatusCobrancas(
  n: number,
  adimplencia: number,
): { pago: number[]; pendente: number[]; atrasado: number[] } {
  const nPago = Math.floor(n * adimplencia);
  const nRestante = n - nPago;
  const nAtrasado = Math.floor(nRestante * 0.4); // ~40% dos inadimplentes estão atrasados
  const nPendente = nRestante - nAtrasado;

  // As 3 primeiras unidades sempre ficam fora do bloco PAGO — são as que os
  // primeiros condôminos de demo de cada condomínio estão vinculados (mesmo
  // princípio do seed original: todo login de condômino tem cobrança em
  // aberto pra mostrar em /minha-unidade).
  const pago: number[] = [];
  const pendente: number[] = [];
  const atrasado: number[] = [];

  for (let i = 0; i < n; i++) {
    if (i < 3) {
      if (i < nAtrasado) atrasado.push(i);
      else pendente.push(i);
    } else {
      if (pago.length < nPago - Math.max(0, nPago - (n - 3))) {
        pago.push(i);
      } else if (pendente.length < nPendente) {
        pendente.push(i);
      } else if (atrasado.length < nAtrasado) {
        atrasado.push(i);
      } else {
        pago.push(i);
      }
    }
  }
  for (let i = 3; i < n; i++) {
    if (!pago.includes(i) && !pendente.includes(i) && !atrasado.includes(i)) {
      pago.push(i);
    }
  }

  return { pago, pendente, atrasado };
}

// ─── Funções de criação ───────────────────────────────────────────────────────

async function criarUnidades(
  prisma: PrismaService,
  condominioId: string,
  quantidade: number,
  cpfOffset: number,
): Promise<Unidade[]> {
  const unidades: Unidade[] = [];
  for (let i = 0; i < quantidade; i++) {
    const andar = Math.floor(i / 4) + 1;
    const apto = (i % 4) + 1;
    const identificador = `${andar}0${apto}`;
    const unidade = await prisma.unidade.create({
      data: {
        condominioId,
        identificador,
        tipo: 'apartamento',
        responsavelNome: `Responsável ${identificador}`,
        responsavelEmail: `resp.${identificador}.${cpfOffset}@demo.condly.app`,
        responsavelCpfCnpj: cpfFicticio(cpfOffset + i),
      },
    });
    unidades.push(unidade);
  }
  return unidades;
}

async function criarCobrancasCondominio(
  prisma: PrismaService,
  unidades: Unidade[],
  adimplencia: number,
  baseCondominial: number,
): Promise<void> {
  const hoje = new Date();
  const inicioMes = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1);
  const fimMes = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0);

  const diaUm = (offset: number) =>
    new Date(Math.min(hoje.getTime(), inicioMes + offset * 86_400_000));
  const diaFuturo = (offset: number) =>
    new Date(Math.min(fimMes, hoje.getTime() + offset * 86_400_000));
  const diaPassado = (offset: number) =>
    new Date(Math.max(inicioMes, hoje.getTime() - offset * 86_400_000));

  const { pago, pendente, atrasado } = distribuirStatusCobrancas(unidades.length, adimplencia);

  for (const idx of pago) {
    const venc = diaUm(4);
    await prisma.cobranca.create({
      data: {
        unidadeId: unidades[idx].id,
        valor: valorCondominial(idx, baseCondominial),
        vencimento: venc,
        status: 'PAGO',
        pagoEm: venc,
      },
    });
  }

  const offsetsPendente = [5, 10, 14, 18, 22, 25];
  for (let i = 0; i < pendente.length; i++) {
    await prisma.cobranca.create({
      data: {
        unidadeId: unidades[pendente[i]].id,
        valor: valorCondominial(pendente[i], baseCondominial),
        vencimento: diaFuturo(offsetsPendente[i % offsetsPendente.length]),
        status: 'PENDENTE',
      },
    });
  }

  const offsetsAtrasado = [12, 22, 35, 50, 65];
  for (let i = 0; i < atrasado.length; i++) {
    await prisma.cobranca.create({
      data: {
        unidadeId: unidades[atrasado[i]].id,
        valor: valorCondominial(atrasado[i], baseCondominial),
        vencimento: diaPassado(offsetsAtrasado[i % offsetsAtrasado.length]),
        status: 'ATRASADO',
      },
    });
  }
}

async function criarAreasComuns(prisma: PrismaService, condominioId: string) {
  const regras = {
    horarioAbertura: '08:00',
    horarioFechamento: '22:00',
    duracaoMinimaMinutos: 60,
    antecedenciaMaximaDias: 30,
  };
  const salao = await prisma.areaComum.create({
    data: { condominioId, nome: 'Salão de Festas', regrasReserva: regras },
  });
  const piscina = await prisma.areaComum.create({
    data: { condominioId, nome: 'Piscina', regrasReserva: { ...regras, horarioFechamento: '20:00' } },
  });
  const churrasqueira = await prisma.areaComum.create({
    data: { condominioId, nome: 'Churrasqueira', regrasReserva: regras },
  });
  return { salao, piscina, churrasqueira };
}

async function criarReservas(
  prisma: PrismaService,
  areas: Awaited<ReturnType<typeof criarAreasComuns>>,
  unidades: Unidade[],
): Promise<void> {
  const hoje = new Date();
  const emDias = (dias: number, hora: number) => {
    const d = new Date(hoje.getTime() + dias * 86_400_000);
    d.setUTCHours(hora, 0, 0, 0);
    return d;
  };
  if (unidades.length < 3) return;
  await prisma.reserva.create({
    data: { areaComumId: areas.salao.id, unidadeId: unidades[0].id, inicio: emDias(5, 18), fim: emDias(5, 23), status: 'CONFIRMADA' },
  });
  await prisma.reserva.create({
    data: { areaComumId: areas.piscina.id, unidadeId: unidades[1].id, inicio: emDias(2, 10), fim: emDias(2, 16), status: 'CONFIRMADA' },
  });
  await prisma.reserva.create({
    data: { areaComumId: areas.churrasqueira.id, unidadeId: unidades[2].id, inicio: emDias(8, 12), fim: emDias(8, 17), status: 'CONFIRMADA' },
  });
}

async function criarServicosPeriodicosCondominio(
  prisma: PrismaService,
  condominioId: string,
  servicos: { nome: string; diasDoHoje: number }[],
): Promise<void> {
  const hoje = new Date();
  for (const s of servicos) {
    const data = new Date(hoje.getTime() + s.diasDoHoje * 86_400_000);
    await prisma.servicoPeriodico.create({
      data: { condominioId, nome: s.nome, proximoVencimento: data },
    });
  }
}

// ─── Usuários de demonstração ─────────────────────────────────────────────────
// 1 administradora global, e por condomínio: 1 síndico + até 10 condôminos
// (um por unidade, começando na unidade 101). Os 5 logins originais
// (administradora.demo, sindico.demo, condomino1..3.demo) continuam
// exatamente os mesmos, vinculados ao primeiro condomínio.

interface UsuariosCondominio {
  sindico: Usuario;
  condominos: Usuario[];
}

interface UsuariosDemo {
  administradora: Usuario;
  porCondominio: UsuariosCondominio[];
}

async function criarUsuariosDemo(
  prisma: PrismaService,
  administradora: Administradora,
  condominios: Condominio[],
  todasUnidades: Unidade[][],
): Promise<UsuariosDemo> {
  const senhaHash = await bcrypt.hash(SENHA_DEMO, 10);

  // Telefones sequenciais e únicos — o bot do WhatsApp resolve identidade
  // exclusivamente pelo telefone, então dois usuários nunca podem repetir.
  let telefoneSeq = 100;
  const proximoTelefone = () => `55119${String(telefoneSeq++).padStart(8, '0')}`;

  const usuarioAdm = await prisma.usuario.create({
    data: { nome: 'Ana Administradora', email: 'administradora.demo@condly.app', telefoneWhatsapp: '5511900000001', senhaHash },
  });
  await prisma.vinculoUsuario.create({
    data: { usuarioId: usuarioAdm.id, papel: 'ADMINISTRADORA', administradoraId: administradora.id },
  });

  const telefonesOriginais = ['5511900000002', '5511900000003', '5511900000004', '5511900000005'];

  const porCondominio: UsuariosCondominio[] = [];
  for (let c = 0; c < condominios.length; c++) {
    const condominio = condominios[c];
    const unidades = todasUnidades[c];

    const sindico = await prisma.usuario.create({
      data: {
        nome: NOMES_SINDICOS[c % NOMES_SINDICOS.length],
        email: emailSindico(c),
        telefoneWhatsapp: c === 0 ? telefonesOriginais[0] : proximoTelefone(),
        senhaHash,
      },
    });
    await prisma.vinculoUsuario.create({
      data: { usuarioId: sindico.id, papel: 'SINDICO', condominioId: condominio.id },
    });

    const condominos: Usuario[] = [];
    const quantidade = quantidadeCondominos(unidades.length);
    for (let j = 0; j < quantidade; j++) {
      const telefone =
        c === 0 && j < 3 ? telefonesOriginais[j + 1] : proximoTelefone();
      const condomino = await prisma.usuario.create({
        data: {
          nome: nomeCondomino(c, j),
          email: emailCondomino(c, j),
          telefoneWhatsapp: telefone,
          senhaHash,
        },
      });
      await prisma.vinculoUsuario.create({
        data: { usuarioId: condomino.id, papel: 'CONDOMINO', unidadeId: unidades[j].id },
      });
      condominos.push(condomino);
    }

    porCondominio.push({ sindico, condominos });
  }

  return { administradora: usuarioAdm, porCondominio };
}

// ─── Avisos ───────────────────────────────────────────────────────────────────

const AVISOS_GERAIS: { titulo: string; corpo: string }[] = [
  { titulo: 'Manutenção da caixa d\'água', corpo: 'No próximo sábado, das 8h às 12h, faremos a manutenção anual da caixa d\'água. Pode haver interrupção no fornecimento de água nesse período.' },
  { titulo: 'Dedetização das áreas comuns', corpo: 'Na próxima terça-feira faremos a dedetização das áreas comuns. Mantenha portas e janelas fechadas entre 9h e 12h.' },
  { titulo: 'Limpeza da piscina', corpo: 'A piscina ficará interditada na quinta-feira para limpeza e tratamento químico. Reabertura prevista para sexta às 10h.' },
  { titulo: 'Assembleia geral convocada', corpo: 'Convocamos todos os condôminos para a assembleia geral ordinária. O edital com data, horário e pauta está disponível na seção de documentos.' },
  { titulo: 'Nova regra da garagem', corpo: 'A partir do dia 1º, a permanência de veículos de visitantes na garagem está limitada a 12 horas. Consulte o regulamento atualizado.' },
  { titulo: 'Troca dos extintores', corpo: 'Os extintores dos halls de cada andar serão substituídos ao longo desta semana. Não é necessário nenhum acesso às unidades.' },
  { titulo: 'Obras no salão de festas', corpo: 'O salão de festas ficará fechado para reforma do piso nas próximas duas semanas. Reservas nesse período serão remanejadas.' },
  { titulo: 'Atualização da portaria', corpo: 'O sistema de interfone da portaria será atualizado nesta quinta. Podem ocorrer instabilidades pontuais durante a manhã.' },
  { titulo: 'Campanha de coleta seletiva', corpo: 'Novos coletores de recicláveis foram instalados no térreo. Separe seu lixo: a coleta seletiva passa às terças e sextas.' },
  { titulo: 'Recadastramento de veículos', corpo: 'Solicitamos o recadastramento de todos os veículos até o fim do mês na administração. Traga o documento do veículo.' },
];

async function criarAvisosDemo(
  prisma: PrismaService,
  condominios: Condominio[],
  todasUnidades: Unidade[][],
  usuarios: UsuariosDemo,
): Promise<void> {
  const haDoisDias = new Date(Date.now() - 2 * 86_400_000);
  const haCincoDias = new Date(Date.now() - 5 * 86_400_000);

  // Um aviso geral por condomínio, com uma linha de leitura pra cada
  // destinatário do escopo (síndico + todos os condôminos) — síndico já leu,
  // condôminos ainda não (pra caixa de não lidos de cada login ter conteúdo).
  for (let c = 0; c < condominios.length; c++) {
    const { sindico, condominos } = usuarios.porCondominio[c];
    const modelo = AVISOS_GERAIS[c % AVISOS_GERAIS.length];
    const aviso = await prisma.aviso.create({
      data: {
        condominioId: condominios[c].id,
        titulo: modelo.titulo,
        corpo: modelo.corpo,
        canais: ['APP', 'EMAIL'],
        enviadoEm: haDoisDias,
      },
    });
    const destinatarios = [sindico, ...condominos];
    for (let i = 0; i < destinatarios.length; i++) {
      await prisma.avisoLeitura.create({
        data: { avisoId: aviso.id, usuarioId: destinatarios[i].id, lidoEm: i === 0 ? haDoisDias : null },
      });
    }
  }

  // Aviso direcionado a uma unidade específica, só no primeiro condomínio
  const avisoUnidade = await prisma.aviso.create({
    data: {
      condominioId: condominios[0].id,
      unidadeId: todasUnidades[0][0].id,
      titulo: 'Atualização de cadastro pendente',
      corpo: 'Identificamos que o cadastro do responsável pela sua unidade está incompleto. Acesse o app pra atualizar seus dados.',
      canais: ['APP'],
      enviadoEm: haCincoDias,
    },
  });
  await prisma.avisoLeitura.create({
    data: { avisoId: avisoUnidade.id, usuarioId: usuarios.porCondominio[0].condominos[0].id, lidoEm: null },
  });
}

// ─── Enquetes ─────────────────────────────────────────────────────────────────
// Configuração declarativa (também consumida pelo smoke test de contagens):
// enquetes no primeiro condomínio nos 3 estados (ATIVA/ENCERRADA/RASCUNHO) e
// uma ATIVA em outros dois condomínios. `votosDeCondominos` indica quantos
// condôminos do condomínio votam (distribuídos entre as opções por rotação).

export const ENQUETES_CONFIG = [
  {
    condominioIdx: 0,
    titulo: 'Pintura da fachada — escolha da cor',
    descricao: 'A pintura da fachada está prevista para o próximo trimestre. Vote na paleta de cores de sua preferência.',
    tipo: 'GESTAO',
    status: 'ATIVA',
    anonima: false,
    inicioDias: -5,
    fimDias: 10,
    opcoes: ['Branco gelo com detalhes em cinza', 'Bege com detalhes em marrom', 'Manter a cor atual (verde claro)'],
    votosDeCondominos: 6,
  },
  {
    condominioIdx: 0,
    titulo: 'Instalação de bicicletário na garagem',
    descricao: 'Proposta de instalação de bicicletário coberto na vaga não utilizada ao lado da entrada de serviço.',
    tipo: 'SERVICO',
    status: 'ENCERRADA',
    anonima: false,
    inicioDias: -30,
    fimDias: -10,
    opcoes: ['A favor', 'Contra'],
    votosDeCondominos: 8,
  },
  {
    condominioIdx: 0,
    titulo: 'Mudança do horário de funcionamento da piscina',
    descricao: 'Avaliação preliminar: estender o horário da piscina até as 22h nos fins de semana.',
    tipo: 'GESTAO',
    status: 'RASCUNHO',
    anonima: true,
    inicioDias: 5,
    fimDias: 20,
    opcoes: ['Estender até 22h', 'Manter até 20h'],
    votosDeCondominos: 0,
  },
  {
    condominioIdx: 1,
    titulo: 'Contratação de zelador em período integral',
    descricao: 'O condomínio hoje conta com zelador meio período. Proposta de ampliação para período integral.',
    tipo: 'SERVICO',
    status: 'ATIVA',
    anonima: false,
    inicioDias: -3,
    fimDias: 12,
    opcoes: ['A favor', 'Contra'],
    votosDeCondominos: 5,
  },
  {
    condominioIdx: 2,
    titulo: 'Reforma do playground',
    descricao: 'Escolha da prioridade de investimento para a área de lazer infantil neste semestre.',
    tipo: 'GESTAO',
    status: 'ATIVA',
    anonima: false,
    inicioDias: -7,
    fimDias: 8,
    opcoes: ['Trocar os brinquedos', 'Instalar piso emborrachado', 'Cobertura contra sol e chuva'],
    votosDeCondominos: 5,
  },
] as const;

async function criarEnquetesDemo(
  prisma: PrismaService,
  condominios: Condominio[],
  usuarios: UsuariosDemo,
): Promise<void> {
  const emDias = (dias: number) => new Date(Date.now() + dias * 86_400_000);

  for (const cfg of ENQUETES_CONFIG) {
    const enquete = await prisma.enquete.create({
      data: {
        condominioId: condominios[cfg.condominioIdx].id,
        titulo: cfg.titulo,
        descricao: cfg.descricao,
        tipo: cfg.tipo,
        status: cfg.status,
        anonima: cfg.anonima,
        inicioEm: emDias(cfg.inicioDias),
        fimEm: emDias(cfg.fimDias),
        opcoes: {
          create: cfg.opcoes.map((texto, i) => ({ texto, ordem: i + 1 })),
        },
      },
      include: { opcoes: { orderBy: { ordem: 'asc' } } },
    });

    const { condominos } = usuarios.porCondominio[cfg.condominioIdx];
    const votantes = condominos.slice(0, cfg.votosDeCondominos);
    for (let j = 0; j < votantes.length; j++) {
      await prisma.votoEnquete.create({
        data: {
          enqueteId: enquete.id,
          opcaoId: enquete.opcoes[j % enquete.opcoes.length].id,
          usuarioId: votantes[j].id,
        },
      });
    }
  }
}

// ─── Assembleias ──────────────────────────────────────────────────────────────

export const ASSEMBLEIAS_CONFIG = [
  {
    condominioIdx: 0,
    titulo: 'Assembleia Geral Ordinária 2026',
    tipo: 'ORDINARIA',
    status: 'AGENDADA',
    diasDoHoje: 15,
    local: 'Salão de Festas',
    linkGravacao: null,
    pautas: [
      { titulo: 'Prestação de contas do exercício', descricao: 'Apresentação do balanço anual pela administradora.', deliberacao: null },
      { titulo: 'Aprovação da previsão orçamentária', descricao: 'Orçamento proposto para o próximo exercício.', deliberacao: null },
      { titulo: 'Eleição do conselho fiscal', descricao: 'Renovação dos três assentos do conselho.', deliberacao: null },
    ],
    documentos: [{ titulo: 'Edital de convocação', url: null }],
  },
  {
    condominioIdx: 0,
    titulo: 'Assembleia Extraordinária — Reforma da fachada',
    tipo: 'EXTRAORDINARIA',
    status: 'REALIZADA',
    diasDoHoje: -45,
    local: 'Salão de Festas',
    linkGravacao: 'https://meet.example.com/gravacoes/assembleia-fachada',
    pautas: [
      { titulo: 'Aprovação da reforma da fachada', descricao: 'Três orçamentos apresentados pela administradora.', deliberacao: 'Aprovada por maioria (14 votos a favor, 3 contra) a proposta da empresa Fachadas Prime, no valor de R$ 180.000,00 em 10 parcelas.' },
      { titulo: 'Forma de rateio', descricao: 'Definição entre fundo de reserva e taxa extra.', deliberacao: 'Aprovado rateio em taxa extra de R$ 150,00 por unidade durante 10 meses, iniciando no próximo mês.' },
    ],
    documentos: [
      { titulo: 'Ata da assembleia', url: null },
      { titulo: 'Orçamento aprovado — Fachadas Prime', url: null },
    ],
  },
  {
    condominioIdx: 3,
    titulo: 'Assembleia Geral Ordinária 2026',
    tipo: 'ORDINARIA',
    status: 'AGENDADA',
    diasDoHoje: 22,
    local: 'Área gourmet — Torre A',
    linkGravacao: null,
    pautas: [
      { titulo: 'Prestação de contas do exercício', descricao: null, deliberacao: null },
      { titulo: 'Reajuste da taxa condominial', descricao: 'Proposta de reajuste de 6% a partir do próximo trimestre.', deliberacao: null },
    ],
    documentos: [],
  },
] as const;

async function criarAssembleiasDemo(
  prisma: PrismaService,
  condominios: Condominio[],
): Promise<void> {
  for (const cfg of ASSEMBLEIAS_CONFIG) {
    await prisma.assembleia.create({
      data: {
        condominioId: condominios[cfg.condominioIdx].id,
        titulo: cfg.titulo,
        tipo: cfg.tipo,
        status: cfg.status,
        dataHora: new Date(Date.now() + cfg.diasDoHoje * 86_400_000),
        local: cfg.local,
        linkGravacao: cfg.linkGravacao,
        pautas: {
          create: cfg.pautas.map((p, i) => ({
            ordem: i + 1,
            titulo: p.titulo,
            descricao: p.descricao,
            deliberacao: p.deliberacao,
          })),
        },
        documentos: {
          create: cfg.documentos.map((d) => ({ titulo: d.titulo, url: d.url })),
        },
      },
    });
  }
}

// ─── Ações administrativas ────────────────────────────────────────────────────

export const ACOES_ADMINISTRATIVAS_CONFIG = [
  { condominioIdx: 0, titulo: 'Renovação do contrato de limpeza', descricao: 'Contrato renovado com a Limpar Serviços por mais 12 meses, sem reajuste.', realizadaDias: -20, validoAteDias: 345 },
  { condominioIdx: 0, titulo: 'Recarga dos extintores', descricao: 'Todos os 14 extintores recarregados e lacrados pela Extinseg.', realizadaDias: -60, validoAteDias: 305 },
  { condominioIdx: 0, titulo: 'Notificação da obra irregular no 302', descricao: 'Notificação formal entregue ao responsável pela unidade sobre obra sem comunicação prévia.', realizadaDias: -10, validoAteDias: null },
  { condominioIdx: 1, titulo: 'Contratação de seguro predial', descricao: 'Apólice renovada com cobertura ampliada para danos elétricos.', realizadaDias: -35, validoAteDias: 330 },
] as const;

async function criarAcoesAdministrativasDemo(
  prisma: PrismaService,
  condominios: Condominio[],
): Promise<void> {
  for (const cfg of ACOES_ADMINISTRATIVAS_CONFIG) {
    await prisma.acaoAdministrativa.create({
      data: {
        condominioId: condominios[cfg.condominioIdx].id,
        titulo: cfg.titulo,
        descricao: cfg.descricao,
        realizadaEm: new Date(Date.now() + cfg.realizadaDias * 86_400_000),
        validoAte:
          cfg.validoAteDias === null
            ? null
            : new Date(Date.now() + cfg.validoAteDias * 86_400_000),
      },
    });
  }
}

// ─── Documentos ───────────────────────────────────────────────────────────────
// As linhas apontam pra keys de objeto que não existem no R2 (nenhuma conta
// real configurada em dev) — a listagem funciona normalmente; o download
// falha de forma controlada, mesmo comportamento já documentado pro fluxo
// de upload em dev (ver CLAUDE.md, Prompt 10.6).

export const DOCUMENTOS_CONFIG = [
  { condominioIdx: 0, tipo: 'Ata de assembleia', visibilidade: 'TODOS' },
  { condominioIdx: 0, tipo: 'Regulamento interno', visibilidade: 'TODOS' },
  { condominioIdx: 0, tipo: 'Prestação de contas', visibilidade: 'SINDICO_ADMINISTRADORA' },
] as const;

async function criarDocumentosDemo(
  prisma: PrismaService,
  condominios: Condominio[],
): Promise<void> {
  for (let i = 0; i < DOCUMENTOS_CONFIG.length; i++) {
    const cfg = DOCUMENTOS_CONFIG[i];
    const condominioId = condominios[cfg.condominioIdx].id;
    await prisma.documento.create({
      data: {
        condominioId,
        tipo: cfg.tipo,
        urlArquivo: `demo/${condominioId}/documento-${i + 1}.pdf`,
        visibilidade: cfg.visibilidade,
      },
    });
  }
}

// ─── Dados complementares de unidade ─────────────────────────────────────────
// Perfis preenchidos pras 3 unidades dos condôminos de demonstração do
// primeiro condomínio — o painel "Dados da unidade" (chamados/perfil) tem o
// que mostrar pro síndico/administradora sem precisar preencher na mão.

async function criarDadosUnidadeDemo(
  prisma: PrismaService,
  unidadesDoPrimeiro: Unidade[],
): Promise<void> {
  await prisma.dadosUnidade.create({
    data: {
      unidadeId: unidadesDoPrimeiro[0].id,
      pets: true,
      petsDescricao: '1 cachorro de pequeno porte (Pipoca, shih-tzu)',
      trabalhadorNoturno: true,
      statusOcupacao: 'PROPRIETARIO',
      veiculos: [{ placa: 'BRA2E19', modelo: 'Fiat Argo', cor: 'Prata' }],
      contatoEmergenciaNome: 'Marcos (irmão)',
      contatoEmergenciaTelefone: '5511988880001',
    },
  });
  await prisma.dadosUnidade.create({
    data: {
      unidadeId: unidadesDoPrimeiro[1].id,
      bebeRecemNascido: true,
      statusOcupacao: 'INQUILINO',
      veiculos: [
        { placa: 'RIO4A21', modelo: 'Honda Civic', cor: 'Preto' },
        { placa: 'SAO9B33', modelo: 'Honda Biz', cor: 'Vermelha' },
      ],
      contatoEmergenciaNome: 'Helena (mãe)',
      contatoEmergenciaTelefone: '5511988880002',
    },
  });
  await prisma.dadosUnidade.create({
    data: {
      unidadeId: unidadesDoPrimeiro[2].id,
      pessoasIdosas: true,
      mobilidadeReduzida: true,
      statusOcupacao: 'PROPRIETARIO',
      veiculos: [],
      contatoEmergenciaNome: 'Dra. Paula (médica da família)',
      contatoEmergenciaTelefone: '5511988880003',
    },
  });
}

// ─── Seed principal ───────────────────────────────────────────────────────────

export async function seed(prisma: PrismaService): Promise<void> {
  await limparBanco(prisma);

  const administradora = await prisma.administradora.create({
    data: { nome: 'Administradora Demo', emailContato: 'contato@administradorademo.example.com' },
  });

  // Cria os 10 condomínios em sequência, coletando as unidades de cada um
  const condominiosCriados: Condominio[] = [];
  const todasUnidades: Unidade[][] = [];
  let cpfOffset = 0;

  for (const cfg of CONDOMINIOS_CONFIG) {
    const condominio = await prisma.condominio.create({
      data: {
        administradoraId: administradora.id,
        nome: cfg.nome,
        endereco: cfg.endereco,
        cnpj: cfg.cnpj,
      },
    });
    condominiosCriados.push(condominio);

    const unidades = await criarUnidades(prisma, condominio.id, cfg.unidades, cpfOffset);
    cpfOffset += cfg.unidades;
    todasUnidades.push(unidades);

    await criarCobrancasCondominio(prisma, unidades, cfg.adimplencia, cfg.baseCondominial);

    const areas = await criarAreasComuns(prisma, condominio.id);
    await criarReservas(prisma, areas, unidades);
  }

  // Serviços periódicos mapeados por condomínio
  for (const s of SERVICOS_PERIODICOS) {
    const condominio = condominiosCriados[s.condominioIdx];
    await criarServicosPeriodicosCondominio(prisma, condominio.id, [{ nome: s.nome, diasDoHoje: s.diasDoHoje }]);
  }

  // Usuários de demo: administradora + síndico e condôminos de cada condomínio
  const usuarios = await criarUsuariosDemo(prisma, administradora, condominiosCriados, todasUnidades);
  const primeiroCondominio = condominiosCriados[0];
  const unidadesDoPrimeiro = todasUnidades[0];

  // Chamados de demonstração — abertos pelo síndico do próprio condomínio,
  // ou por um condômino específico quando configurado
  for (const c of CHAMADOS_CONFIG) {
    const condominio = condominiosCriados[c.condominioIdx];
    const unidades = todasUnidades[c.condominioIdx];
    const { sindico, condominos } = usuarios.porCondominio[c.condominioIdx];
    if (unidades.length === 0) continue;

    const abertoPorCondomino =
      c.abertoPorCondominoIdx !== undefined ? condominos[c.abertoPorCondominoIdx] : undefined;
    await prisma.chamado.create({
      data: {
        condominioId: condominio.id,
        unidadeId:
          c.abertoPorCondominoIdx !== undefined
            ? unidades[c.abertoPorCondominoIdx].id
            : unidades[0].id,
        abertoPorId: abertoPorCondomino ? abertoPorCondomino.id : sindico.id,
        titulo: c.titulo,
        categoria: c.categoria,
        status: c.status as any,
      },
    });
  }

  // Advertências de demonstração no primeiro condomínio
  await prisma.advertencia.create({
    data: {
      condominioId: primeiroCondominio.id,
      unidadeId: unidadesDoPrimeiro[0].id,
      remetenteId: usuarios.porCondominio[0].sindico.id,
      motivo: 'BARULHO',
      descricao: 'Recebemos reclamações de barulho excessivo proveniente desta unidade nos fins de semana após as 22h. Pedimos que respeite o horário de silêncio conforme o regulamento interno.',
    },
  });
  await prisma.advertencia.create({
    data: {
      condominioId: primeiroCondominio.id,
      unidadeId: unidadesDoPrimeiro[1].id,
      remetenteId: usuarios.porCondominio[0].sindico.id,
      motivo: 'DESCUMPRIMENTO_REGRAS',
      descricao: 'Foram identificados animais de grande porte nas áreas comuns sem guia e focinheira, em descumprimento ao art. 12 do regulamento interno.',
    },
  });

  await criarAvisosDemo(prisma, condominiosCriados, todasUnidades, usuarios);
  await criarEnquetesDemo(prisma, condominiosCriados, usuarios);
  await criarAssembleiasDemo(prisma, condominiosCriados);
  await criarAcoesAdministrativasDemo(prisma, condominiosCriados);
  await criarDocumentosDemo(prisma, condominiosCriados);
  await criarDadosUnidadeDemo(prisma, unidadesDoPrimeiro);
}

// ─── Contagens esperadas (consumidas pelo smoke test) ─────────────────────────
// Derivadas das mesmas configurações usadas pra criar os dados, pra que o
// scripts/verify-seed-counts.ts nunca precise de recontagem manual quando a
// configuração do cenário mudar.

export function contagensEsperadas(): Record<string, number> {
  const totalUnidades = CONDOMINIOS_CONFIG.reduce((s, c) => s + c.unidades, 0);
  const totalCondominos = CONDOMINIOS_CONFIG.reduce(
    (s, c) => s + quantidadeCondominos(c.unidades),
    0,
  );
  // 1 administradora + 1 síndico por condomínio + condôminos
  const totalUsuarios = 1 + CONDOMINIOS_CONFIG.length + totalCondominos;

  let cobrancasPago = 0;
  let cobrancasPendente = 0;
  let cobrancasAtrasado = 0;
  for (const c of CONDOMINIOS_CONFIG) {
    const { pago, pendente, atrasado } = distribuirStatusCobrancas(c.unidades, c.adimplencia);
    cobrancasPago += pago.length;
    cobrancasPendente += pendente.length;
    cobrancasAtrasado += atrasado.length;
  }

  const contagemChamados = (status: string) =>
    CHAMADOS_CONFIG.filter((c) => c.status === status).length;

  // Aviso geral por condomínio (leituras: síndico + condôminos) + 1 aviso de
  // unidade no primeiro condomínio (1 leitura)
  const leiturasAvisosGerais = CONDOMINIOS_CONFIG.reduce(
    (s, c) => s + 1 + quantidadeCondominos(c.unidades),
    0,
  );

  return {
    administradora: 1,
    condominio: CONDOMINIOS_CONFIG.length,
    unidade: totalUnidades,
    usuario: totalUsuarios,
    vinculoUsuario: totalUsuarios,
    cobrancaTotal: totalUnidades,
    cobrancaPago: cobrancasPago,
    cobrancaPendente: cobrancasPendente,
    cobrancaAtrasado: cobrancasAtrasado,
    areaComum: 3 * CONDOMINIOS_CONFIG.length,
    reserva: 3 * CONDOMINIOS_CONFIG.length,
    chamadoTotal: CHAMADOS_CONFIG.length,
    chamadoAberto: contagemChamados('ABERTO'),
    chamadoEmAndamento: contagemChamados('EM_ANDAMENTO'),
    chamadoPendenteTriagem: contagemChamados('PENDENTE_TRIAGEM'),
    chamadoResolvido: contagemChamados('RESOLVIDO'),
    servicoPeriodico: SERVICOS_PERIODICOS.length,
    aviso: CONDOMINIOS_CONFIG.length + 1,
    avisoLeitura: leiturasAvisosGerais + 1,
    advertencia: 2,
    enquete: ENQUETES_CONFIG.length,
    opcaoEnquete: ENQUETES_CONFIG.reduce((s, e) => s + e.opcoes.length, 0),
    votoEnquete: ENQUETES_CONFIG.reduce((s, e) => s + e.votosDeCondominos, 0),
    assembleia: ASSEMBLEIAS_CONFIG.length,
    pautaAssembleia: ASSEMBLEIAS_CONFIG.reduce((s, a) => s + a.pautas.length, 0),
    assembleiaDocumento: ASSEMBLEIAS_CONFIG.reduce((s, a) => s + a.documentos.length, 0),
    acaoAdministrativa: ACOES_ADMINISTRATIVAS_CONFIG.length,
    documento: DOCUMENTOS_CONFIG.length,
    dadosUnidade: 3,
  };
}

// ─── Validação e entry point ──────────────────────────────────────────────────

function validarBancoDeDesenvolvimento(): void {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl.includes('_dev') && !databaseUrl.includes('_test')) {
    throw new Error(
      'DATABASE_URL não parece apontar pra um banco de desenvolvimento/teste ' +
        '("_dev"/"_test" no nome). Recusando rodar o seed, que apaga todo o ' +
        'conteúdo das tabelas de domínio antes de popular o cenário de demonstração.',
    );
  }
}

async function main(): Promise<void> {
  validarBancoDeDesenvolvimento();

  const prisma = new PrismaService();
  await prisma.onModuleInit();
  try {
    await seed(prisma);
    console.log('\nSeed de demonstração aplicado com sucesso.\n');
    console.log(`Senha de todos os usuários: ${SENHA_DEMO}\n`);
    console.log('Login de administradora: administradora.demo@condly.app');
    console.log('\nSíndicos (um por condomínio):');
    CONDOMINIOS_CONFIG.forEach((cfg, i) => {
      console.log(`  ${emailSindico(i).padEnd(28)} → ${cfg.nome}`);
    });
    console.log('\nCondôminos (até 10 por condomínio, unidades 101 em diante):');
    console.log('  condomino{1..10}.demo@condly.app        → Residencial Ipê Verde');
    console.log('  condomino{1..10}.c{N}.demo@condly.app   → N-ésimo condomínio da lista');
    console.log('  (ex: condomino1.c2.demo@condly.app é a unidade 101 do Edifício Maracanã)');
  } finally {
    await prisma.onModuleDestroy();
  }
}

if (require.main === module) {
  main().catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
}
