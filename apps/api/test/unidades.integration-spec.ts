import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from './helpers/cleanup-database';
import { criarFixtures, SENHA_PLANA } from './helpers/auth-fixtures';

describe('Módulo unidades', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixtures: Awaited<ReturnType<typeof criarFixtures>>;

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, senha: SENHA_PLANA });
    return res.body.accessToken;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);
    await limparBanco(prisma);
    fixtures = await criarFixtures(prisma);
  });

  afterAll(async () => {
    await limparBanco(prisma);
    await app.close();
  });

  describe('GET /unidades/me/saldo', () => {
    it('retorna a cobrança pendente mais recente da unidade do condômino logado', async () => {
      await prisma.cobranca.create({
        data: {
          unidadeId: fixtures.unidade1.id,
          valor: 100,
          vencimento: new Date('2026-01-10'),
          status: 'PAGO',
          pagoEm: new Date('2026-01-09'),
        },
      });
      const maisRecente = await prisma.cobranca.create({
        data: {
          unidadeId: fixtures.unidade1.id,
          valor: 480.9,
          vencimento: new Date('2026-06-10'),
          status: 'ATRASADO',
          linkPagamento: 'https://fake-asaas.example.com/i/pay_unidade1',
        },
      });

      const token = await login(fixtures.usuarioCondomino.email);
      const res = await request(app.getHttpServer())
        .get('/unidades/me/saldo')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.unidadeId).toBe(fixtures.unidade1.id);
      expect(res.body.cobrancaPendente.id).toBe(maisRecente.id);
      expect(res.body.cobrancaPendente.status).toBe('ATRASADO');
      expect(res.body.cobrancaPendente.linkPagamento).toBe(
        'https://fake-asaas.example.com/i/pay_unidade1',
      );
    });

    it('nunca retorna a cobrança da unidade de outro condômino', async () => {
      const senhaHash = (
        await prisma.usuario.findUniqueOrThrow({
          where: { id: fixtures.usuarioCondomino.id },
        })
      ).senhaHash;
      const outroCondomino = await prisma.usuario.create({
        data: {
          nome: 'Outro Condômino',
          email: 'outro-condomino@example.com',
          senhaHash,
        },
      });
      await prisma.vinculoUsuario.create({
        data: {
          usuarioId: outroCondomino.id,
          papel: 'CONDOMINO',
          unidadeId: fixtures.unidade2.id,
        },
      });
      await prisma.cobranca.create({
        data: {
          unidadeId: fixtures.unidade2.id,
          valor: 999,
          vencimento: new Date('2026-06-15'),
          status: 'PENDENTE',
        },
      });

      const token = await login(outroCondomino.email);
      const res = await request(app.getHttpServer())
        .get('/unidades/me/saldo')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.unidadeId).toBe(fixtures.unidade2.id);
      expect(res.body.cobrancaPendente.valor).toBe('999');

      // O condômino da unidade1 (outro tenant/unidade) continua vendo só a
      // própria cobrança, nunca a de unidade2 criada acima.
      const tokenUnidade1 = await login(fixtures.usuarioCondomino.email);
      const resUnidade1 = await request(app.getHttpServer())
        .get('/unidades/me/saldo')
        .set('Authorization', `Bearer ${tokenUnidade1}`);
      expect(resUnidade1.body.unidadeId).toBe(fixtures.unidade1.id);
      expect(resUnidade1.body.cobrancaPendente?.unidadeId).not.toBe(fixtures.unidade2.id);
    });

    it('retorna 404 quando o usuário não tem nenhum vínculo com unidade', async () => {
      const token = await login(fixtures.usuarioSindico.email);
      const res = await request(app.getHttpServer())
        .get('/unidades/me/saldo')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
