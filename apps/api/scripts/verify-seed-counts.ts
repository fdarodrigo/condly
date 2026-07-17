import 'dotenv/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { contagensEsperadas } from '../prisma/seed';

/**
 * Confere as contagens esperadas do cenário de demonstração (prisma/seed.ts)
 * — detecta rapidamente se uma mudança futura no schema (ex: novo campo
 * obrigatório, constraint nova) quebrou o seed silenciosamente. Roda contra
 * o banco já apontado por DATABASE_URL no momento da chamada (ver
 * scripts/seed-smoke-test.js, que aponta pro TEST_DATABASE_URL antes de
 * invocar este script).
 *
 * As contagens esperadas são derivadas das mesmas configurações que o seed
 * usa pra criar os dados (contagensEsperadas em prisma/seed.ts) — mudar o
 * cenário de demonstração não exige recontagem manual aqui.
 */
async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.onModuleInit();

  const esperado = contagensEsperadas();

  const checagens: Array<[string, number, number]> = [
    ['Administradora', await prisma.administradora.count(), esperado.administradora],
    ['Condominio', await prisma.condominio.count(), esperado.condominio],
    ['Unidade', await prisma.unidade.count(), esperado.unidade],
    ['Usuario', await prisma.usuario.count(), esperado.usuario],
    ['VinculoUsuario', await prisma.vinculoUsuario.count(), esperado.vinculoUsuario],
    ['Cobranca (total)', await prisma.cobranca.count(), esperado.cobrancaTotal],
    ['Cobranca PAGO', await prisma.cobranca.count({ where: { status: 'PAGO' } }), esperado.cobrancaPago],
    ['Cobranca PENDENTE', await prisma.cobranca.count({ where: { status: 'PENDENTE' } }), esperado.cobrancaPendente],
    ['Cobranca ATRASADO', await prisma.cobranca.count({ where: { status: 'ATRASADO' } }), esperado.cobrancaAtrasado],
    ['AreaComum', await prisma.areaComum.count(), esperado.areaComum],
    ['Reserva', await prisma.reserva.count(), esperado.reserva],
    ['Chamado (total)', await prisma.chamado.count(), esperado.chamadoTotal],
    ['Chamado ABERTO', await prisma.chamado.count({ where: { status: 'ABERTO' } }), esperado.chamadoAberto],
    ['Chamado EM_ANDAMENTO', await prisma.chamado.count({ where: { status: 'EM_ANDAMENTO' } }), esperado.chamadoEmAndamento],
    ['Chamado PENDENTE_TRIAGEM', await prisma.chamado.count({ where: { status: 'PENDENTE_TRIAGEM' } }), esperado.chamadoPendenteTriagem],
    ['Chamado RESOLVIDO', await prisma.chamado.count({ where: { status: 'RESOLVIDO' } }), esperado.chamadoResolvido],
    ['ServicoPeriodico', await prisma.servicoPeriodico.count(), esperado.servicoPeriodico],
    ['Aviso', await prisma.aviso.count(), esperado.aviso],
    ['AvisoLeitura', await prisma.avisoLeitura.count(), esperado.avisoLeitura],
    ['Advertencia', await prisma.advertencia.count(), esperado.advertencia],
    ['Enquete', await prisma.enquete.count(), esperado.enquete],
    ['OpcaoEnquete', await prisma.opcaoEnquete.count(), esperado.opcaoEnquete],
    ['VotoEnquete', await prisma.votoEnquete.count(), esperado.votoEnquete],
    ['Assembleia', await prisma.assembleia.count(), esperado.assembleia],
    ['PautaAssembleia', await prisma.pautaAssembleia.count(), esperado.pautaAssembleia],
    ['AssembleiaDocumento', await prisma.assembleiaDocumento.count(), esperado.assembleiaDocumento],
    ['AcaoAdministrativa', await prisma.acaoAdministrativa.count(), esperado.acaoAdministrativa],
    ['Documento', await prisma.documento.count(), esperado.documento],
    ['DadosUnidade', await prisma.dadosUnidade.count(), esperado.dadosUnidade],
  ];

  let falhou = false;
  for (const [nome, real, esperadoValor] of checagens) {
    const ok = real === esperadoValor;
    if (!ok) falhou = true;
    console.log(`${ok ? 'OK    ' : 'FALHOU'} ${nome}: esperado ${esperadoValor}, encontrado ${real}`);
  }

  await prisma.onModuleDestroy();

  if (falhou) {
    console.error('\nSmoke test do seed FALHOU — alguma contagem não bate.');
    process.exit(1);
  }
  console.log('\nSmoke test do seed passou — todas as contagens batem.');
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
