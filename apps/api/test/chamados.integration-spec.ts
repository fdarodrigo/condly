import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from './helpers/cleanup-database';
import { criarFixtures, SENHA_PLANA } from './helpers/auth-fixtures';
import { CHAMADO_STATUS_ALTERADO } from '../src/chamados/events/chamado-status-alterado.event';
import { CHAMADO_REABERTO } from '../src/chamados/events/chamado-reaberto.event';
import { StatusChamado } from '../generated/prisma/client';

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

  describe('PATCH /chamados/:chamadoId — máquina de estados', () => {
    async function criarChamadoComStatus(status: StatusChamado) {
      return prisma.chamado.create({
        data: {
          condominioId: fixtures.condominio1.id,
          abertoPorId: fixtures.usuarioSindico.id,
          categoria: 'teste-transicao',
          status,
        },
      });
    }

    const TRANSICOES_VALIDAS: Array<[StatusChamado, StatusChamado]> = [
      ['PENDENTE_TRIAGEM', 'ABERTO'],
      ['ABERTO', 'EM_ANDAMENTO'],
      ['EM_ANDAMENTO', 'RESOLVIDO'],
      ['RESOLVIDO', 'ABERTO'],
    ];

    it.each(TRANSICOES_VALIDAS)('permite a transição %s → %s', async (de, para) => {
      const chamado = await criarChamadoComStatus(de);

      const res = await request(app.getHttpServer())
        .patch(`/chamados/${chamado.id}`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ status: para });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(para);
    });

    it('reabertura (RESOLVIDO → ABERTO) grava reabertoEm e dispara chamado.reaberto, além de chamado.status_alterado', async () => {
      const chamado = await criarChamadoComStatus('RESOLVIDO');

      const eventosStatus: unknown[] = [];
      const eventosReabertura: unknown[] = [];
      const listenerStatus = (evento: unknown) => eventosStatus.push(evento);
      const listenerReabertura = (evento: unknown) => eventosReabertura.push(evento);
      eventEmitter.on(CHAMADO_STATUS_ALTERADO, listenerStatus);
      eventEmitter.on(CHAMADO_REABERTO, listenerReabertura);

      const res = await request(app.getHttpServer())
        .patch(`/chamados/${chamado.id}`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ status: 'ABERTO' });

      eventEmitter.off(CHAMADO_STATUS_ALTERADO, listenerStatus);
      eventEmitter.off(CHAMADO_REABERTO, listenerReabertura);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ABERTO');
      expect(res.body.reabertoEm).not.toBeNull();

      expect(eventosStatus).toHaveLength(1);
      expect(eventosStatus[0]).toMatchObject({
        chamadoId: chamado.id,
        statusAnterior: 'RESOLVIDO',
        statusNovo: 'ABERTO',
      });

      expect(eventosReabertura).toHaveLength(1);
      expect(eventosReabertura[0]).toMatchObject({
        chamadoId: chamado.id,
        condominioId: fixtures.condominio1.id,
      });
    });

    const TRANSICOES_INVALIDAS: Array<[StatusChamado, StatusChamado]> = [
      // pular a triagem
      ['PENDENTE_TRIAGEM', 'RESOLVIDO'],
      ['PENDENTE_TRIAGEM', 'EM_ANDAMENTO'],
      // voltar de ABERTO para a triagem, ou pular direto pra RESOLVIDO
      ['ABERTO', 'PENDENTE_TRIAGEM'],
      ['ABERTO', 'RESOLVIDO'],
      // retroceder a partir de EM_ANDAMENTO
      ['EM_ANDAMENTO', 'ABERTO'],
      ['EM_ANDAMENTO', 'PENDENTE_TRIAGEM'],
      // qualquer coisa a partir de RESOLVIDO que não seja a reabertura
      ['RESOLVIDO', 'PENDENTE_TRIAGEM'],
      ['RESOLVIDO', 'EM_ANDAMENTO'],
      // "transição" para o mesmo status atual, em todo estado
      ['PENDENTE_TRIAGEM', 'PENDENTE_TRIAGEM'],
      ['ABERTO', 'ABERTO'],
      ['EM_ANDAMENTO', 'EM_ANDAMENTO'],
      ['RESOLVIDO', 'RESOLVIDO'],
    ];

    it.each(TRANSICOES_INVALIDAS)('rejeita com 400 a transição %s → %s', async (de, para) => {
      const chamado = await criarChamadoComStatus(de);

      const res = await request(app.getHttpServer())
        .patch(`/chamados/${chamado.id}`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ status: para });

      expect(res.status).toBe(400);

      const inalterado = await prisma.chamado.findUnique({ where: { id: chamado.id } });
      expect(inalterado?.status).toBe(de);
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

    it('condômino vê só os chamados que abriu ou que são da própria unidade — nunca de outra unidade do mesmo condomínio', async () => {
      await prisma.chamado.deleteMany({});

      const unidadeOutroMorador = await prisma.unidade.create({
        data: { condominioId: fixtures.condominio1.id, identificador: '202', tipo: 'apartamento' },
      });

      const abertoPeloProprioCondomino = await prisma.chamado.create({
        data: {
          condominioId: fixtures.condominio1.id,
          unidadeId: fixtures.unidade1.id,
          abertoPorId: fixtures.usuarioCondomino.id,
          categoria: 'aberto-pelo-proprio',
          status: 'PENDENTE_TRIAGEM',
        },
      });
      const daPropriaUnidadeAbertoPorOutroAutor = await prisma.chamado.create({
        data: {
          condominioId: fixtures.condominio1.id,
          unidadeId: fixtures.unidade1.id,
          abertoPorId: fixtures.usuarioSindico.id,
          categoria: 'da-propria-unidade-aberto-pelo-sindico',
          status: 'ABERTO',
        },
      });
      const deOutraUnidade = await prisma.chamado.create({
        data: {
          condominioId: fixtures.condominio1.id,
          unidadeId: unidadeOutroMorador.id,
          abertoPorId: fixtures.usuarioSindico.id,
          categoria: 'de-outra-unidade',
          status: 'ABERTO',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio1.id}/chamados`)
        .set('Authorization', `Bearer ${tokenCondomino}`);

      expect(res.status).toBe(200);
      const idsRetornados = res.body.map((c: { id: string }) => c.id);
      expect(idsRetornados.sort()).toEqual(
        [abertoPeloProprioCondomino.id, daPropriaUnidadeAbertoPorOutroAutor.id].sort(),
      );
      expect(idsRetornados).not.toContain(deOutraUnidade.id);
    });

    it('condômino de outro tenant NÃO acessa a listagem do condomínio (403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio2.id}/chamados`)
        .set('Authorization', `Bearer ${tokenCondomino}`);

      expect(res.status).toBe(403);
    });
  });
});
