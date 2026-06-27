import 'dotenv/config';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Confere as contagens esperadas do cenário de demonstração (prisma/seed.ts)
 * — detecta rapidamente se uma mudança futura no schema (ex: novo campo
 * obrigatório, constraint nova) quebrou o seed silenciosamente. Roda contra
 * o banco já apontado por DATABASE_URL no momento da chamada (ver
 * scripts/seed-smoke-test.js, que aponta pro TEST_DATABASE_URL antes de
 * invocar este script).
 */
async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.onModuleInit();

  const checagens: Array<[string, number, number]> = [
    ['Administradora', await prisma.administradora.count(), 1],
    ['Condominio', await prisma.condominio.count(), 1],
    ['Unidade', await prisma.unidade.count(), 18],
    ['Usuario', await prisma.usuario.count(), 5],
    ['VinculoUsuario', await prisma.vinculoUsuario.count(), 5],
    ['Cobranca (total)', await prisma.cobranca.count(), 18],
    ['Cobranca PAGO', await prisma.cobranca.count({ where: { status: 'PAGO' } }), 12],
    ['Cobranca PENDENTE', await prisma.cobranca.count({ where: { status: 'PENDENTE' } }), 4],
    ['Cobranca ATRASADO', await prisma.cobranca.count({ where: { status: 'ATRASADO' } }), 2],
    ['AreaComum', await prisma.areaComum.count(), 2],
    ['Reserva', await prisma.reserva.count(), 5],
    ['Chamado (total)', await prisma.chamado.count(), 3],
    ['Chamado ABERTO', await prisma.chamado.count({ where: { status: 'ABERTO' } }), 1],
    ['Chamado EM_ANDAMENTO', await prisma.chamado.count({ where: { status: 'EM_ANDAMENTO' } }), 1],
    ['Chamado RESOLVIDO', await prisma.chamado.count({ where: { status: 'RESOLVIDO' } }), 1],
    ['Aviso', await prisma.aviso.count(), 2],
    ['AvisoLeitura', await prisma.avisoLeitura.count(), 5],
  ];

  let falhou = false;
  for (const [nome, real, esperado] of checagens) {
    const ok = real === esperado;
    if (!ok) falhou = true;
    console.log(`${ok ? 'OK    ' : 'FALHOU'} ${nome}: esperado ${esperado}, encontrado ${real}`);
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
