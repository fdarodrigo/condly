import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from './helpers/cleanup-database';
import { criarFixtures, SENHA_PLANA } from './helpers/auth-fixtures';
import { CHAMADO_STATUS_ALTERADO } from '../src/chamados/events/chamado-status-alterado.event';

describe('Módulo chamados', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;
  let fixtures: Awaited<ReturnType<typeof criarFixtures>>;
  let tokenSindico: string;
  let tokenCondomino: string;
  let tokenAdministradora: string;

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
    eventEmitter = moduleRef.get(EventEmitter2);

    await limparBanco(prisma);
    fixtures = await criarFixtures(prisma);

    tokenSindico = await login(fixtures.usuarioSindico.email);
    tokenCondomino = await login(fixtures.usuarioCondomino.email);
    tokenAdministradora = await login(fixtures.usuarioAdministradora.email);
  });

  afterAll(async () => {
    await limparBanco(prisma);
    await app.close();
  });

  describe('POST /condominios/:condominioId/chamados', () => {
    it('síndico abre chamado já com status ABERTO', async () => {
      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/chamados`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ categoria: 'manutenção' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ABERTO');
      expect(res.body.abertoPorId).toBe(fixtures.usuarioSindico.id);
    });

    it('condômino abre chamado com status PENDENTE_TRIAGEM e unidade própria por padrão', async () => {
      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/chamados`)
        .set('Authorization', `Bearer ${tokenCondomino}`)
        .send({ categoria: 'vazamento' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDENTE_TRIAGEM');
      expect(res.body.abertoPorId).toBe(fixtures.usuarioCondomino.id);
      expect(res.body.unidadeId).toBe(fixtures.unidade1.id);
    });

    it('dispara chamado.status_alterado na abertura', async () => {
      const eventos: unknown[] = [];
      const listener = (evento: unknown) => eventos.push(evento);
      eventEmitter.on(CHAMADO_STATUS_ALTERADO, listener);

      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/chamados`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ categoria: 'segurança' });

      eventEmitter.off(CHAMADO_STATUS_ALTERADO, listener);

      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({
        chamadoId: res.body.id,
        condominioId: fixtures.condominio1.id,
        statusAnterior: null,
        statusNovo: 'ABERTO',
      });
    });

    it('condômino NÃO abre chamado em condomínio de outro tenant (403)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio2.id}/chamados`)
        .set('Authorization', `Bearer ${tokenCondomino}`)
        .send({ categoria: 'qualquer' });

      expect(res.status).toBe(403);
    });

    it('administradora não está autorizada a abrir chamado (403)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/chamados`)
        .set('Authorization', `Bearer ${tokenAdministradora}`)
        .send({ categoria: 'qualquer' });

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /chamados/:chamadoId', () => {
    it('síndico faz a transição ABERTO → EM_ANDAMENTO → RESOLVIDO, cada uma disparando o evento', async () => {
      const abertura = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/chamados`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ categoria: 'elevador' });
      const chamadoId = abertura.body.id;

      const eventos: unknown[] = [];
      const listener = (evento: unknown) => eventos.push(evento);
      eventEmitter.on(CHAMADO_STATUS_ALTERADO, listener);

      const emAndamento = await request(app.getHttpServer())
        .patch(`/chamados/${chamadoId}`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ status: 'EM_ANDAMENTO', responsavelId: fixtures.usuarioSindico.id });
      expect(emAndamento.status).toBe(200);
      expect(emAndamento.body.status).toBe('EM_ANDAMENTO');
      expect(emAndamento.body.responsavelId).toBe(fixtures.usuarioSindico.id);

      const resolvido = await request(app.getHttpServer())
        .patch(`/chamados/${chamadoId}`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ status: 'RESOLVIDO' });
      expect(resolvido.status).toBe(200);
      expect(resolvido.body.status).toBe('RESOLVIDO');

      eventEmitter.off(CHAMADO_STATUS_ALTERADO, listener);

      expect(eventos).toHaveLength(2);
      expect(eventos[0]).toMatchObject({
        chamadoId,
        statusAnterior: 'ABERTO',
        statusNovo: 'EM_ANDAMENTO',
      });
      expect(eventos[1]).toMatchObject({
        chamadoId,
        statusAnterior: 'EM_ANDAMENTO',
        statusNovo: 'RESOLVIDO',
      });
    });

    it('NÃO dispara evento quando o PATCH não altera o status', async () => {
      const abertura = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/chamados`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ categoria: 'jardim' });

      const eventos: unknown[] = [];
      const listener = (evento: unknown) => eventos.push(evento);
      eventEmitter.on(CHAMADO_STATUS_ALTERADO, listener);

      const res = await request(app.getHttpServer())
        .patch(`/chamados/${abertura.body.id}`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ categoria: 'jardinagem' });

      eventEmitter.off(CHAMADO_STATUS_ALTERADO, listener);

      expect(res.status).toBe(200);
      expect(res.body.categoria).toBe('jardinagem');
      expect(eventos).toHaveLength(0);
    });

    it('condômino NÃO pode classificar/atualizar chamado (403)', async () => {
      const abertura = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/chamados`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ categoria: 'portão' });

      const res = await request(app.getHttpServer())
        .patch(`/chamados/${abertura.body.id}`)
        .set('Authorization', `Bearer ${tokenCondomino}`)
        .send({ status: 'EM_ANDAMENTO' });

      expect(res.status).toBe(403);
    });

    it('aceita responsavelId de um usuário com vínculo no mesmo tenant (administradora do próprio condomínio)', async () => {
      const abertura = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/chamados`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ categoria: 'interfone' });

      const res = await request(app.getHttpServer())
        .patch(`/chamados/${abertura.body.id}`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ responsavelId: fixtures.usuarioAdministradora.id });

      expect(res.status).toBe(200);
      expect(res.body.responsavelId).toBe(fixtures.usuarioAdministradora.id);
    });

    it('rejeita com 400 responsavelId de usuário de outro condomínio/administradora', async () => {
      const usuarioOutroTenant = await prisma.usuario.create({
        data: {
          nome: 'Síndico de outro tenant',
          email: 'sindico-outro-tenant@example.com',
          senhaHash: 'hash-irrelevante-para-este-teste',
        },
      });
      await prisma.vinculoUsuario.create({
        data: {
          usuarioId: usuarioOutroTenant.id,
          papel: 'SINDICO',
          condominioId: fixtures.condominio2.id,
        },
      });

      const abertura = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/chamados`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ categoria: 'pintura' });

      const res = await request(app.getHttpServer())
        .patch(`/chamados/${abertura.body.id}`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ responsavelId: usuarioOutroTenant.id });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/vínculo com o condomínio/i);

      const chamadoInalterado = await prisma.chamado.findUnique({
        where: { id: abertura.body.id },
      });
      expect(chamadoInalterado?.responsavelId).toBeNull();
    });

    it('rejeita com 400 responsavelId de usuário sem nenhum vínculo', async () => {
      const usuarioSemVinculo = await prisma.usuario.create({
        data: {
          nome: 'Usuário sem vínculo',
          email: 'sem-vinculo@example.com',
          senhaHash: 'hash-irrelevante-para-este-teste',
        },
      });

      const abertura = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/chamados`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ categoria: 'limpeza' });

      const res = await request(app.getHttpServer())
        .patch(`/chamados/${abertura.body.id}`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ responsavelId: usuarioSemVinculo.id });

      expect(res.status).toBe(400);
    });

    it('síndico de outro tenant NÃO pode atualizar o chamado (403)', async () => {
      const chamadoOutroTenant = await prisma.chamado.create({
        data: {
          condominioId: fixtures.condominio2.id,
          abertoPorId: fixtures.usuarioAdministradora.id,
          categoria: 'qualquer',
          status: 'ABERTO',
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/chamados/${chamadoOutroTenant.id}`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ status: 'EM_ANDAMENTO' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /condominios/:condominioId/chamados', () => {
    it('lista respeitando o isolamento multi-tenant e o filtro por status', async () => {
      await prisma.chamado.deleteMany({});

      await prisma.chamado.create({
        data: {
          condominioId: fixtures.condominio1.id,
          abertoPorId: fixtures.usuarioSindico.id,
          categoria: 'aberto-c1',
          status: 'ABERTO',
        },
      });
      await prisma.chamado.create({
        data: {
          condominioId: fixtures.condominio1.id,
          abertoPorId: fixtures.usuarioSindico.id,
          categoria: 'resolvido-c1',
          status: 'RESOLVIDO',
        },
      });
      await prisma.chamado.create({
        data: {
          condominioId: fixtures.condominio2.id,
          abertoPorId: fixtures.usuarioAdministradora.id,
          categoria: 'aberto-c2',
          status: 'ABERTO',
        },
      });

      const semFiltro = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio1.id}/chamados`)
        .set('Authorization', `Bearer ${tokenSindico}`);

      expect(semFiltro.status).toBe(200);
      expect(semFiltro.body).toHaveLength(2);
      expect(
        semFiltro.body.every(
          (c: { condominioId: string }) => c.condominioId === fixtures.condominio1.id,
        ),
      ).toBe(true);

      const comFiltro = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio1.id}/chamados?status=ABERTO`)
        .set('Authorization', `Bearer ${tokenSindico}`);

      expect(comFiltro.status).toBe(200);
      expect(comFiltro.body).toHaveLength(1);
      expect(comFiltro.body[0].categoria).toBe('aberto-c1');
    });

    it('condômino NÃO acessa a listagem (403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio1.id}/chamados`)
        .set('Authorization', `Bearer ${tokenCondomino}`);

      expect(res.status).toBe(403);
    });
  });
});
