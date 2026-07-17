import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from './helpers/cleanup-database';
import { criarFixtures, SENHA_PLANA } from './helpers/auth-fixtures';

describe('Auth + RBAC multi-tenant', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
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
    jwtService = moduleRef.get(JwtService);

    await limparBanco(prisma);
    fixtures = await criarFixtures(prisma);
  });

  afterAll(async () => {
    await limparBanco(prisma);
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('retorna um JWT válido com credenciais corretas', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: fixtures.usuarioAdministradora.email, senha: SENHA_PLANA });

      expect(res.status).toBe(200);
      expect(typeof res.body.accessToken).toBe('string');

      const payload = jwtService.decode(res.body.accessToken) as {
        sub: string;
        vinculos: unknown[];
      };
      expect(payload.sub).toBe(fixtures.usuarioAdministradora.id);
      expect(payload.vinculos).toHaveLength(1);
    });

    it('retorna 401 com senha incorreta', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: fixtures.usuarioAdministradora.email, senha: 'senha-errada' });

      expect(res.status).toBe(401);
    });

    it('retorna 401 com email inexistente', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'naoexiste@example.com', senha: SENHA_PLANA });

      expect(res.status).toBe(401);
    });
  });

  describe('autenticação por token', () => {
    it('retorna 401 sem cabeçalho Authorization', async () => {
      const res = await request(app.getHttpServer()).get(`/condominios/${fixtures.condominio1.id}`);
      expect(res.status).toBe(401);
    });

    it('retorna 401 com token malformado', async () => {
      const res = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio1.id}`)
        .set('Authorization', 'Bearer token-invalido');
      expect(res.status).toBe(401);
    });

    it('retorna 401 com token expirado', async () => {
      const tokenExpirado = jwtService.sign(
        { sub: fixtures.usuarioAdministradora.id, vinculos: [] },
        { expiresIn: '-10s' },
      );
      const res = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio1.id}`)
        .set('Authorization', `Bearer ${tokenExpirado}`);
      expect(res.status).toBe(401);
    });
  });

  describe('matriz RBAC — ADMINISTRADORA', () => {
    it('acessa o condomínio da sua própria administradora (200)', async () => {
      const token = await login(fixtures.usuarioAdministradora.email);
      const res = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio1.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(fixtures.condominio1.id);
    });

    it('acessa uma unidade da sua administradora via hierarquia (200)', async () => {
      const token = await login(fixtures.usuarioAdministradora.email);
      const res = await request(app.getHttpServer())
        .get(`/unidades/${fixtures.unidade1.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(fixtures.unidade1.id);
    });

    it('NÃO acessa condomínio de outra administradora (403)', async () => {
      const token = await login(fixtures.usuarioAdministradora.email);
      const res = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio2.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('matriz RBAC — SINDICO', () => {
    it('acessa o próprio condomínio (200)', async () => {
      const token = await login(fixtures.usuarioSindico.email);
      const res = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio1.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(fixtures.condominio1.id);
    });

    it('NÃO acessa o condomínio de outro tenant (403)', async () => {
      const token = await login(fixtures.usuarioSindico.email);
      const res = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio2.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('NÃO acessa o recurso de administradora (403)', async () => {
      const token = await login(fixtures.usuarioSindico.email);
      const res = await request(app.getHttpServer())
        .get(`/administradoras/${fixtures.administradora1.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('matriz RBAC — CONDOMINO', () => {
    it('acessa a própria unidade (200)', async () => {
      const token = await login(fixtures.usuarioCondomino.email);
      const res = await request(app.getHttpServer())
        .get(`/unidades/${fixtures.unidade1.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(fixtures.unidade1.id);
    });

    it('NÃO acessa unidade de outro tenant (403)', async () => {
      const token = await login(fixtures.usuarioCondomino.email);
      const res = await request(app.getHttpServer())
        .get(`/unidades/${fixtures.unidade2.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    // Liberado de propósito: a topbar do frontend mostra o nome do condomínio
    // associado pra CONDOMINO/SINDICO via GET /condominios/:id — o vínculo de
    // CONDOMINO autoriza no nível do próprio condomínio (resolvido a partir
    // da unidade no login), nunca no de outro tenant (teste abaixo).
    it('acessa o próprio condomínio (200)', async () => {
      const token = await login(fixtures.usuarioCondomino.email);
      const res = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio1.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(fixtures.condominio1.id);
    });

    it('NÃO acessa condomínio de outro tenant (403)', async () => {
      const token = await login(fixtures.usuarioCondomino.email);
      const res = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio2.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  it('retorna 404 (não 403) para recurso inexistente', async () => {
    const token = await login(fixtures.usuarioAdministradora.email);
    const res = await request(app.getHttpServer())
      .get('/condominios/id-que-nao-existe')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
