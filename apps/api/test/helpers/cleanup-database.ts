import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Limpa todas as tabelas de domínio em ordem segura de FK. Usado no
 * início/fim de cada spec de integração pra garantir um banco limpo,
 * já que `test:integration` roda os specs em sequência contra o mesmo
 * `condly_test`.
 */
export async function limparBanco(prisma: PrismaService): Promise<void> {
  await prisma.vinculoUsuario.deleteMany();
  await prisma.avisoLeitura.deleteMany();
  await prisma.conversaBot.deleteMany();
  await prisma.reserva.deleteMany();
  await prisma.cobranca.deleteMany();
  await prisma.chamado.deleteMany();
  await prisma.documento.deleteMany();
  await prisma.aviso.deleteMany();
  await prisma.servicoPeriodico.deleteMany();
  await prisma.areaComum.deleteMany();
  await prisma.unidade.deleteMany();
  await prisma.condominio.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.administradora.deleteMany();
}
