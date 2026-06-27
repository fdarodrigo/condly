import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from '../test/helpers/cleanup-database';
import { Administradora, Condominio, Unidade, Usuario } from '../generated/prisma/client';

export const SENHA_DEMO = 'Demo123!';

const TOTAL_UNIDADES = 18;
const QTD_PAGO = 12;
const QTD_PENDENTE = 4;
const QTD_ATRASADO = 2;

function valorCondominial(indice: number): number {
  return 450 + (indice % 3) * 20;
}

// Formato plausível de CPF só pra preencher o campo (ver pendência no
// CLAUDE.md) — nunca passa por validação de dígito verificador real, porque
// o seed nunca chama o Asaas (Cobranca é inserida direto via Prisma, sem
// passar por FinanceiroService/AsaasClient).
function cpfFicticio(indice: number): string {
  const sufixo = String(indice + 1).padStart(2, '0');
  return `529.982.${sufixo}7-25`;
}

async function criarUnidades(prisma: PrismaService, condominioId: string): Promise<Unidade[]> {
  const unidades: Unidade[] = [];
  for (let i = 0; i < TOTAL_UNIDADES; i++) {
    const andar = Math.floor(i / 3) + 1;
    const apto = (i % 3) + 1;
    const identificador = `${andar}0${apto}`;
    const unidade = await prisma.unidade.create({
      data: {
        condominioId,
        identificador,
        tipo: 'apartamento',
        responsavelNome: `Responsável da Unidade ${identificador}`,
        responsavelEmail: `responsavel.${identificador}@demo.condly.app`,
        responsavelCpfCnpj: cpfFicticio(i),
      },
    });
    unidades.push(unidade);
  }
  return unidades;
}

interface UsuariosDemo {
  administradora: Usuario;
  sindico: Usuario;
  condominos: Usuario[];
}

async function criarUsuarios(
  prisma: PrismaService,
  administradora: Administradora,
  condominio: Condominio,
  unidades: Unidade[],
): Promise<UsuariosDemo> {
  const senhaHash = await bcrypt.hash(SENHA_DEMO, 10);

  const usuarioAdministradora = await prisma.usuario.create({
    data: {
      nome: 'Ana Administradora',
      email: 'administradora.demo@condly.app',
      telefoneWhatsapp: '5511900000001',
      senhaHash,
    },
  });
  await prisma.vinculoUsuario.create({
    data: {
      usuarioId: usuarioAdministradora.id,
      papel: 'ADMINISTRADORA',
      administradoraId: administradora.id,
    },
  });

  const usuarioSindico = await prisma.usuario.create({
    data: {
      nome: 'Sérgio Síndico',
      email: 'sindico.demo@condly.app',
      telefoneWhatsapp: '5511900000002',
      senhaHash,
    },
  });
  await prisma.vinculoUsuario.create({
    data: { usuarioId: usuarioSindico.id, papel: 'SINDICO', condominioId: condominio.id },
  });

  const nomesCondominos = ['Carla Condômina', 'Caio Condômino', 'Cíntia Condômina'];
  const condominos: Usuario[] = [];
  for (let i = 0; i < nomesCondominos.length; i++) {
    const usuarioCondomino = await prisma.usuario.create({
      data: {
        nome: nomesCondominos[i],
        email: `condomino${i + 1}.demo@condly.app`,
        telefoneWhatsapp: `551190000000${3 + i}`,
        senhaHash,
      },
    });
    await prisma.vinculoUsuario.create({
      data: { usuarioId: usuarioCondomino.id, papel: 'CONDOMINO', unidadeId: unidades[i].id },
    });
    condominos.push(usuarioCondomino);
  }

  return { administradora: usuarioAdministradora, sindico: usuarioSindico, condominos };
}

/**
 * Datas calculadas relativas a "hoje" e fixadas dentro do mês atual — o
 * seed precisa produzir o mesmo cenário coerente ("12 pagas, 4 pendentes, 2
 * atrasadas há mais de 10 dias, tudo no mês atual") em qualquer dia em que
 * for executado. Quando "hoje" está nos primeiros dias do mês, o clamp pro
 * início do mês pode deixar uma cobrança "atrasada" com menos de 10 dias de
 * atraso — tradeoff aceito conscientemente pra um seed de demonstração, não
 * pra dado real de cobrança.
 */
async function criarCobrancas(prisma: PrismaService, unidades: Unidade[]): Promise<void> {
  const hoje = new Date();
  const inicioMes = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1);
  const fimMes = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0);
  const diaUm = (offsetDias: number) => new Date(Math.min(hoje.getTime(), inicioMes + offsetDias * 86_400_000));
  const diaFuturo = (offsetDias: number) => new Date(Math.min(fimMes, hoje.getTime() + offsetDias * 86_400_000));
  const diaPassado = (offsetDias: number) => new Date(Math.max(inicioMes, hoje.getTime() - offsetDias * 86_400_000));

  for (let i = 0; i < QTD_PAGO; i++) {
    const vencimento = diaUm(4);
    await prisma.cobranca.create({
      data: {
        unidadeId: unidades[i].id,
        valor: valorCondominial(i),
        vencimento,
        status: 'PAGO',
        pagoEm: vencimento,
      },
    });
  }

  const offsetsPendente = [3, 7, 10, 14];
  for (let i = 0; i < QTD_PENDENTE; i++) {
    const indiceUnidade = QTD_PAGO + i;
    await prisma.cobranca.create({
      data: {
        unidadeId: unidades[indiceUnidade].id,
        valor: valorCondominial(indiceUnidade),
        vencimento: diaFuturo(offsetsPendente[i]),
        status: 'PENDENTE',
      },
    });
  }

  const offsetsAtrasado = [15, 22];
  for (let i = 0; i < QTD_ATRASADO; i++) {
    const indiceUnidade = QTD_PAGO + QTD_PENDENTE + i;
    await prisma.cobranca.create({
      data: {
        unidadeId: unidades[indiceUnidade].id,
        valor: valorCondominial(indiceUnidade),
        vencimento: diaPassado(offsetsAtrasado[i]),
        status: 'ATRASADO',
      },
    });
  }
}

interface AreasComunsDemo {
  salaoDeFestas: { id: string };
  churrasqueira: { id: string };
}

async function criarAreasComuns(prisma: PrismaService, condominioId: string): Promise<AreasComunsDemo> {
  const regrasReserva = {
    horarioAbertura: '08:00',
    horarioFechamento: '22:00',
    duracaoMinimaMinutos: 60,
    antecedenciaMaximaDias: 30,
  };

  const salaoDeFestas = await prisma.areaComum.create({
    data: { condominioId, nome: 'Salão de Festas', regrasReserva },
  });
  const churrasqueira = await prisma.areaComum.create({
    data: { condominioId, nome: 'Churrasqueira', regrasReserva },
  });

  return { salaoDeFestas, churrasqueira };
}

async function criarReservas(
  prisma: PrismaService,
  areas: AreasComunsDemo,
  unidades: Unidade[],
): Promise<void> {
  const hoje = new Date();
  const emDias = (offsetDias: number, horas: number, minutos = 0) => {
    const data = new Date(hoje.getTime() + offsetDias * 86_400_000);
    data.setUTCHours(horas, minutos, 0, 0);
    return data;
  };

  const reservasSalao = [
    { dias: 3, unidade: unidades[0] },
    { dias: 10, unidade: unidades[3] },
    { dias: 20, unidade: unidades[6] },
  ];
  for (const { dias, unidade } of reservasSalao) {
    await prisma.reserva.create({
      data: {
        areaComumId: areas.salaoDeFestas.id,
        unidadeId: unidade.id,
        inicio: emDias(dias, 19),
        fim: emDias(dias, 23),
        status: 'CONFIRMADA',
      },
    });
  }

  const reservasChurrasqueira = [
    { dias: 5, unidade: unidades[1] },
    { dias: 12, unidade: unidades[4] },
  ];
  for (const { dias, unidade } of reservasChurrasqueira) {
    await prisma.reserva.create({
      data: {
        areaComumId: areas.churrasqueira.id,
        unidadeId: unidade.id,
        inicio: emDias(dias, 12),
        fim: emDias(dias, 16),
        status: 'CONFIRMADA',
      },
    });
  }
}

async function criarChamados(
  prisma: PrismaService,
  condominioId: string,
  unidades: Unidade[],
  usuarios: UsuariosDemo,
): Promise<void> {
  await prisma.chamado.create({
    data: {
      condominioId,
      unidadeId: unidades[0].id,
      abertoPorId: usuarios.condominos[0].id,
      categoria: 'Vazamento no encanamento do banheiro',
      status: 'ABERTO',
    },
  });
  await prisma.chamado.create({
    data: {
      condominioId,
      unidadeId: unidades[1].id,
      abertoPorId: usuarios.condominos[1].id,
      responsavelId: usuarios.sindico.id,
      categoria: 'Elevador social com ruído estranho',
      status: 'EM_ANDAMENTO',
    },
  });
  await prisma.chamado.create({
    data: {
      condominioId,
      unidadeId: unidades[2].id,
      abertoPorId: usuarios.condominos[2].id,
      responsavelId: usuarios.sindico.id,
      categoria: 'Lâmpada queimada no hall de entrada',
      status: 'RESOLVIDO',
    },
  });
}

async function criarAvisos(
  prisma: PrismaService,
  condominioId: string,
  unidades: Unidade[],
  usuarios: UsuariosDemo,
): Promise<void> {
  const haDoisDias = new Date(Date.now() - 2 * 86_400_000);
  const haCincoDias = new Date(Date.now() - 5 * 86_400_000);

  const avisoGeral = await prisma.aviso.create({
    data: {
      condominioId,
      titulo: 'Manutenção da caixa d\'água',
      corpo:
        'No próximo sábado, das 8h às 12h, faremos a manutenção anual da caixa ' +
        'd\'água. Pode haver interrupção no fornecimento de água nesse período.',
      canais: ['APP', 'EMAIL'],
      enviadoEm: haDoisDias,
    },
  });
  // Escopo "condomínio inteiro": síndico + todos os condôminos (mesma regra
  // de resolverDestinatariosDoAviso) — uma leitura já marcada, pra mostrar
  // variedade lido/não lido na demonstração.
  const destinatariosAvisoGeral = [usuarios.sindico, ...usuarios.condominos];
  for (let i = 0; i < destinatariosAvisoGeral.length; i++) {
    await prisma.avisoLeitura.create({
      data: {
        avisoId: avisoGeral.id,
        usuarioId: destinatariosAvisoGeral[i].id,
        lidoEm: i === 0 ? haDoisDias : null,
      },
    });
  }

  const avisoUnidade = await prisma.aviso.create({
    data: {
      condominioId,
      unidadeId: unidades[0].id,
      titulo: 'Atualização de cadastro pendente',
      corpo:
        'Identificamos que o cadastro do responsável pela sua unidade está ' +
        'incompleto. Acesse o app pra atualizar seus dados.',
      canais: ['APP'],
      enviadoEm: haCincoDias,
    },
  });
  // Escopo "unidade específica": só o(s) condômino(s) daquela unidade.
  await prisma.avisoLeitura.create({
    data: { avisoId: avisoUnidade.id, usuarioId: usuarios.condominos[0].id, lidoEm: null },
  });
}

export async function seed(prisma: PrismaService): Promise<void> {
  await limparBanco(prisma);

  const administradora = await prisma.administradora.create({
    data: { nome: 'Administradora Demo', emailContato: 'contato@administradorademo.example.com' },
  });

  const condominio = await prisma.condominio.create({
    data: {
      administradoraId: administradora.id,
      nome: 'Residencial Exemplo',
      endereco: 'Rua das Demonstrações, 100',
      cnpj: '00.000.000/0001-00',
    },
  });

  const unidades = await criarUnidades(prisma, condominio.id);
  const usuarios = await criarUsuarios(prisma, administradora, condominio, unidades);
  await criarCobrancas(prisma, unidades);
  const areasComuns = await criarAreasComuns(prisma, condominio.id);
  await criarReservas(prisma, areasComuns, unidades);
  await criarChamados(prisma, condominio.id, unidades, usuarios);
  await criarAvisos(prisma, condominio.id, unidades, usuarios);
}

/**
 * Trava simples contra rodar este script (que apaga TODO o conteúdo das
 * tabelas de domínio — ver `seed()`) num banco que não pareça ser de
 * desenvolvimento/teste. Hoje o produto só tem `condly_dev`/`condly_test`
 * locais, então isso nunca trava o uso legítimo — mas vira uma rede de
 * segurança no dia em que existir um terceiro ambiente (staging/produção)
 * cujo `DATABASE_URL` não inclua um desses sufixos.
 */
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
    console.log('Seed de demonstração aplicado com sucesso.\n');
    console.log(`Senha de todos os usuários de demonstração: ${SENHA_DEMO}\n`);
    console.log('Login de administradora: administradora.demo@condly.app');
    console.log('Login de síndico:        sindico.demo@condly.app');
    console.log('Login de condômino 1:     condomino1.demo@condly.app');
    console.log('Login de condômino 2:     condomino2.demo@condly.app');
    console.log('Login de condômino 3:     condomino3.demo@condly.app');
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
