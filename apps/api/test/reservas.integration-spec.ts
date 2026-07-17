import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from './helpers/cleanup-database';
import { criarFixtures, SENHA_PLANA } from './helpers/auth-fixtures';

function dataDeHojeMaisDias(dias: number): string {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

function isoNoDia(diaISO: string, horario: string): string {
  return `${diaISO}T${horario}:00.000Z`;
}

describe('Módulo reservas', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixtures: Awaited<ReturnType<typeof criarFixtures>>;
  let areaComum1: { id: string; regrasReserva: unknown };
  let areaComum2: { id: string };
  let tokenSindico: string;
  let tokenCondomino: string;

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

    areaComum1 = await prisma.areaComum.create({
      data: {
        condominioId: fixtures.condominio1.id,
        nome: 'Salão de festas',
        regrasReserva: {
          horarioAbertura: '08:00',
          horarioFechamento: '22:00',
          duracaoMinimaMinutos: 60,
          antecedenciaMaximaDias: 30,
        },
      },
    });
    areaComum2 = await prisma.areaComum.create({
      data: {
        condominioId: fixtures.condominio2.id,
        nome: 'Churrasqueira',
        regrasReserva: {
          horarioAbertura: '08:00',
          horarioFechamento: '22:00',
          duracaoMinimaMinutos: 60,
          antecedenciaMaximaDias: 30,
        },
      },
    });

    tokenSindico = await login(fixtures.usuarioSindico.email);
    tokenCondomino = await login(fixtures.usuarioCondomino.email);
  });

  afterAll(async () => {
    await limparBanco(prisma);
    await app.close();
  });

  describe('GET /areas-comuns/:areaComumId/disponibilidade', () => {
    it('retorna o dia inteiro livre quando não há reservas', async () => {
      const dia = dataDeHojeMaisDias(10);
      const res = await request(app.getHttpServer())
        .get(`/areas-comuns/${areaComum1.id}/disponibilidade?data=${dia}`)
        .set('Authorization', `Bearer ${tokenCondomino}`);

      expect(res.status).toBe(200);
      expect(res.body.ocupados).toHaveLength(0);
      expect(res.body.livres).toHaveLength(1);
      expect(res.body.livres[0].inicio).toBe(isoNoDia(dia, '08:00'));
      expect(res.body.livres[0].fim).toBe(isoNoDia(dia, '22:00'));
    });

    it('retorna ocupados e livres considerando uma reserva existente', async () => {
      const dia = dataDeHojeMaisDias(11);
      await prisma.reserva.create({
        data: {
          areaComumId: areaComum1.id,
          unidadeId: fixtures.unidade1.id,
          inicio: new Date(isoNoDia(dia, '10:00')),
          fim: new Date(isoNoDia(dia, '12:00')),
          status: 'CONFIRMADA',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/areas-comuns/${areaComum1.id}/disponibilidade?data=${dia}`)
        .set('Authorization', `Bearer ${tokenSindico}`);

      expect(res.status).toBe(200);
      expect(res.body.ocupados).toHaveLength(1);
      expect(res.body.ocupados[0]).toMatchObject({
        inicio: isoNoDia(dia, '10:00'),
        fim: isoNoDia(dia, '12:00'),
      });
      expect(res.body.livres).toHaveLength(2);
      expect(res.body.livres[0]).toMatchObject({
        inicio: isoNoDia(dia, '08:00'),
        fim: isoNoDia(dia, '10:00'),
      });
      expect(res.body.livres[1]).toMatchObject({
        inicio: isoNoDia(dia, '12:00'),
        fim: isoNoDia(dia, '22:00'),
      });
    });
  });

  describe('POST /areas-comuns/:areaComumId/reservas', () => {
    it('condômino reserva um horário livre com sucesso', async () => {
      const dia = dataDeHojeMaisDias(12);
      const res = await request(app.getHttpServer())
        .post(`/areas-comuns/${areaComum1.id}/reservas`)
        .set('Authorization', `Bearer ${tokenCondomino}`)
        .send({ inicio: isoNoDia(dia, '14:00'), fim: isoNoDia(dia, '16:00') });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('CONFIRMADA');
      expect(res.body.unidadeId).toBe(fixtures.unidade1.id);
      expect(res.body.areaComumId).toBe(areaComum1.id);
    });

    it('retorna 409 com sugestões de horário ao tentar reservar em conflito', async () => {
      const dia = dataDeHojeMaisDias(13);
      const primeira = await request(app.getHttpServer())
        .post(`/areas-comuns/${areaComum1.id}/reservas`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({
          unidadeId: fixtures.unidade1.id,
          inicio: isoNoDia(dia, '10:00'),
          fim: isoNoDia(dia, '12:00'),
        });
      expect(primeira.status).toBe(201);

      const conflitante = await request(app.getHttpServer())
        .post(`/areas-comuns/${areaComum1.id}/reservas`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({
          unidadeId: fixtures.unidade1.id,
          inicio: isoNoDia(dia, '11:00'),
          fim: isoNoDia(dia, '13:00'),
        });

      expect(conflitante.status).toBe(409);
      expect(conflitante.body.message).toMatch(/conflito/i);
      expect(Array.isArray(conflitante.body.sugestoes)).toBe(true);
      expect(conflitante.body.sugestoes.length).toBeGreaterThan(0);
      // o primeiro horário livre sugerido deve começar depois do fim da reserva existente
      expect(new Date(conflitante.body.sugestoes[0].inicio).getTime()).toBeGreaterThanOrEqual(
        new Date(isoNoDia(dia, '12:00')).getTime(),
      );

      const reservasNoBanco = await prisma.reserva.count({
        where: { areaComumId: areaComum1.id, inicio: new Date(isoNoDia(dia, '11:00')) },
      });
      expect(reservasNoBanco).toBe(0);
    });

    it('condômino NÃO pode reservar em nome de outra unidade (403)', async () => {
      const dia = dataDeHojeMaisDias(14);
      const res = await request(app.getHttpServer())
        .post(`/areas-comuns/${areaComum1.id}/reservas`)
        .set('Authorization', `Bearer ${tokenCondomino}`)
        .send({
          unidadeId: fixtures.unidade2.id,
          inicio: isoNoDia(dia, '10:00'),
          fim: isoNoDia(dia, '11:00'),
        });

      expect(res.status).toBe(403);
    });

    it('NÃO permite reservar área comum de outro condomínio (isolamento multi-tenant)', async () => {
      const dia = dataDeHojeMaisDias(15);
      const res = await request(app.getHttpServer())
        .post(`/areas-comuns/${areaComum2.id}/reservas`)
        .set('Authorization', `Bearer ${tokenCondomino}`)
        .send({ inicio: isoNoDia(dia, '10:00'), fim: isoNoDia(dia, '11:00') });

      expect(res.status).toBe(403);

      const reservasCriadas = await prisma.reserva.count({ where: { areaComumId: areaComum2.id } });
      expect(reservasCriadas).toBe(0);
    });

    it('rejeita com 400 reserva fora do horário de funcionamento', async () => {
      const dia = dataDeHojeMaisDias(16);
      const res = await request(app.getHttpServer())
        .post(`/areas-comuns/${areaComum1.id}/reservas`)
        .set('Authorization', `Bearer ${tokenCondomino}`)
        .send({ inicio: isoNoDia(dia, '23:00'), fim: isoNoDia(dia, '23:30') });

      expect(res.status).toBe(400);
    });

    it('rejeita com 400 reserva mais curta que a duração mínima', async () => {
      const dia = dataDeHojeMaisDias(17);
      const res = await request(app.getHttpServer())
        .post(`/areas-comuns/${areaComum1.id}/reservas`)
        .set('Authorization', `Bearer ${tokenCondomino}`)
        .send({ inicio: isoNoDia(dia, '10:00'), fim: isoNoDia(dia, '10:30') });

      expect(res.status).toBe(400);
    });

    it('rejeita com 400 reserva com mais antecedência do que o permitido', async () => {
      const dia = dataDeHojeMaisDias(60);
      const res = await request(app.getHttpServer())
        .post(`/areas-comuns/${areaComum1.id}/reservas`)
        .set('Authorization', `Bearer ${tokenCondomino}`)
        .send({ inicio: isoNoDia(dia, '10:00'), fim: isoNoDia(dia, '11:00') });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /reservas/:reservaId', () => {
    it('cancela a reserva (soft delete) e libera o horário', async () => {
      const dia = dataDeHojeMaisDias(20);
      const criada = await request(app.getHttpServer())
        .post(`/areas-comuns/${areaComum1.id}/reservas`)
        .set('Authorization', `Bearer ${tokenCondomino}`)
        .send({ inicio: isoNoDia(dia, '10:00'), fim: isoNoDia(dia, '11:00') });
      expect(criada.status).toBe(201);

      const cancelamento = await request(app.getHttpServer())
        .delete(`/reservas/${criada.body.id}`)
        .set('Authorization', `Bearer ${tokenCondomino}`);

      expect(cancelamento.status).toBe(200);
      expect(cancelamento.body.status).toBe('CANCELADA');

      const naBase = await prisma.reserva.findUnique({ where: { id: criada.body.id } });
      expect(naBase).not.toBeNull();
      expect(naBase?.status).toBe('CANCELADA');

      // horário liberado: uma nova reserva no mesmo intervalo deve funcionar
      const novaReserva = await request(app.getHttpServer())
        .post(`/areas-comuns/${areaComum1.id}/reservas`)
        .set('Authorization', `Bearer ${tokenCondomino}`)
        .send({ inicio: isoNoDia(dia, '10:00'), fim: isoNoDia(dia, '11:00') });
      expect(novaReserva.status).toBe(201);
    });

    it('rejeita com 400 cancelar uma reserva já cancelada', async () => {
      const dia = dataDeHojeMaisDias(21);
      const criada = await request(app.getHttpServer())
        .post(`/areas-comuns/${areaComum1.id}/reservas`)
        .set('Authorization', `Bearer ${tokenCondomino}`)
        .send({ inicio: isoNoDia(dia, '10:00'), fim: isoNoDia(dia, '11:00') });

      await request(app.getHttpServer())
        .delete(`/reservas/${criada.body.id}`)
        .set('Authorization', `Bearer ${tokenCondomino}`);

      const segundoCancelamento = await request(app.getHttpServer())
        .delete(`/reservas/${criada.body.id}`)
        .set('Authorization', `Bearer ${tokenCondomino}`);

      expect(segundoCancelamento.status).toBe(400);
    });

    it('NÃO permite cancelar reserva de outro tenant (403)', async () => {
      const dia = dataDeHojeMaisDias(22);
      const reservaOutroTenant = await prisma.reserva.create({
        data: {
          areaComumId: areaComum2.id,
          unidadeId: fixtures.unidade2.id,
          inicio: new Date(isoNoDia(dia, '10:00')),
          fim: new Date(isoNoDia(dia, '11:00')),
          status: 'CONFIRMADA',
        },
      });

      const res = await request(app.getHttpServer())
        .delete(`/reservas/${reservaOutroTenant.id}`)
        .set('Authorization', `Bearer ${tokenCondomino}`);

      expect(res.status).toBe(403);

      const inalterada = await prisma.reserva.findUnique({ where: { id: reservaOutroTenant.id } });
      expect(inalterada?.status).toBe('CONFIRMADA');
    });
  });

  describe('GET /condominios/:condominioId/areas-comuns', () => {
    it('lista as áreas comuns do condomínio, ordenadas por nome', async () => {
      const res = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio1.id}/areas-comuns`)
        .set('Authorization', `Bearer ${tokenCondomino}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        {
          id: areaComum1.id,
          nome: 'Salão de festas',
          regrasReserva: areaComum1.regrasReserva,
        },
      ]);
    });

    it('nunca lista a área comum de outro condomínio', async () => {
      const res = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio1.id}/areas-comuns`)
        .set('Authorization', `Bearer ${tokenSindico}`);

      expect(res.status).toBe(200);
      expect(res.body.map((area: { id: string }) => area.id)).not.toContain(areaComum2.id);
    });
  });
});
