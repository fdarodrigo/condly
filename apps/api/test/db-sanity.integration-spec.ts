import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from './helpers/cleanup-database';

describe('banco de teste', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    // Defensivo: outro spec de integração rodado antes deste no mesmo banco
    // pode ter deixado dados se falhar antes do seu próprio cleanup.
    await limparBanco(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('conecta no banco de teste e não encontra nenhuma Administradora', async () => {
    const total = await prisma.administradora.count();
    expect(total).toBe(0);
  });
});
