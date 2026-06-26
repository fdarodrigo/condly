import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ASAAS_CLIENT } from '../src/financeiro/asaas/asaas-client.interface';
import { limparBanco } from './helpers/cleanup-database';
import { criarFixtures, SENHA_PLANA } from './helpers/auth-fixtures';
import { FakeAsaasClient } from './helpers/fake-asaas-client';

const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN!;

describe('Módulo financeiro', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeAsaas: FakeAsaasClient;
  let fixtures: Awaited<ReturnType<typeof criarFixtures>>;
  let tokenSindico: string;

  beforeAll(async () => {
    fakeAsaas = new FakeAsaasClient();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ASAAS_CLIENT)
      .useValue(fakeAsaas)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);
    await limparBanco(prisma);
    fixtures = await criarFixtures(prisma);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixtures.usuarioSindico.email, senha: SENHA_PLANA });
    tokenSindico = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await limparBanco(prisma);
    await app.close();
  });

  describe('POST /condominios/:condominioId/cobrancas', () => {
    it('cria a cobrança local com o idExternoGateway retornado pelo gateway', async () => {
      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/cobrancas`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ unidadeId: fixtures.unidade1.id, valor: 350.5, vencimento: '2026-07-10' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDENTE');
      expect(typeof res.body.idExternoGateway).toBe('string');
      expect(res.body.idExternoGateway).toMatch(/^pay_fake_/);

      const naBase = await prisma.cobranca.findUnique({ where: { id: res.body.id } });
      expect(naBase).not.toBeNull();
      expect(naBase?.idExternoGateway).toBe(res.body.idExternoGateway);

      const ultimaChamada = fakeAsaas.chamadas.at(-1);
      expect(ultimaChamada?.externalReference).toBe(fixtures.unidade1.id);
      expect(ultimaChamada?.subcontaWalletId).toBe(fixtures.condominio1.subcontaGatewayId);
    });

    it('retorna 403 para condomínio de outro tenant', async () => {
      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio2.id}/cobrancas`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ unidadeId: fixtures.unidade2.id, valor: 100, vencimento: '2026-07-10' });

      expect(res.status).toBe(403);
    });
  });

  describe('CPF/CNPJ do responsável em ambiente de produção', () => {
    const ambienteOriginal = process.env.ASAAS_ENV;

    afterEach(async () => {
      process.env.ASAAS_ENV = ambienteOriginal;
      await prisma.unidade.update({
        where: { id: fixtures.unidade1.id },
        data: { responsavelNome: null, responsavelEmail: null, responsavelCpfCnpj: null },
      });
    });

    it('rejeita de forma tratada (não 500) a criação de cobrança em produção sem CPF/CNPJ cadastrado', async () => {
      process.env.ASAAS_ENV = 'production';

      const chamadasAntes = fakeAsaas.chamadas.length;

      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/cobrancas`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ unidadeId: fixtures.unidade1.id, valor: 999, vencimento: '2026-08-01' });

      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/CPF\/CNPJ/i);

      // o gateway nem deve ter sido chamado, e nenhuma Cobranca "fantasma" criada
      expect(fakeAsaas.chamadas.length).toBe(chamadasAntes);
      const cobrancaCriada = await prisma.cobranca.findFirst({
        where: { unidadeId: fixtures.unidade1.id, valor: 999 },
      });
      expect(cobrancaCriada).toBeNull();
    });

    it('cria a cobrança normalmente em produção quando a unidade tem CPF/CNPJ cadastrado', async () => {
      process.env.ASAAS_ENV = 'production';
      await prisma.unidade.update({
        where: { id: fixtures.unidade1.id },
        data: {
          responsavelNome: 'Maria Responsável',
          responsavelEmail: 'maria@example.com',
          responsavelCpfCnpj: '123.456.789-00',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/cobrancas`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ unidadeId: fixtures.unidade1.id, valor: 222, vencimento: '2026-08-02' });

      expect(res.status).toBe(201);

      const ultimaChamada = fakeAsaas.chamadas.at(-1);
      expect(ultimaChamada?.cliente.cpfCnpj).toBe('123.456.789-00');
      expect(ultimaChamada?.cliente.nome).toBe('Maria Responsável');
    });
  });

  describe('POST /webhooks/asaas', () => {
    it('confirma o pagamento de ponta a ponta', async () => {
      const cobranca = await prisma.cobranca.create({
        data: {
          unidadeId: fixtures.unidade1.id,
          valor: 100,
          vencimento: new Date(),
          status: 'PENDENTE',
          idExternoGateway: 'pay_webhook_confirmacao',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/webhooks/asaas')
        .set('asaas-access-token', WEBHOOK_TOKEN)
        .send({
          event: 'PAYMENT_CONFIRMED',
          payment: { id: 'pay_webhook_confirmacao', status: 'CONFIRMED' },
        });

      expect(res.status).toBe(200);

      const atualizada = await prisma.cobranca.findUnique({ where: { id: cobranca.id } });
      expect(atualizada?.status).toBe('PAGO');
      expect(atualizada?.pagoEm).not.toBeNull();
    });

    it('é idempotente — o mesmo webhook duas vezes não duplica nem altera o pagamento já confirmado', async () => {
      const cobranca = await prisma.cobranca.create({
        data: {
          unidadeId: fixtures.unidade1.id,
          valor: 200,
          vencimento: new Date(),
          status: 'PENDENTE',
          idExternoGateway: 'pay_webhook_idempotencia',
        },
      });

      const payload = {
        event: 'PAYMENT_CONFIRMED',
        payment: { id: 'pay_webhook_idempotencia', status: 'CONFIRMED' },
      };

      const primeira = await request(app.getHttpServer())
        .post('/webhooks/asaas')
        .set('asaas-access-token', WEBHOOK_TOKEN)
        .send(payload);
      expect(primeira.status).toBe(200);

      const apósPrimeira = await prisma.cobranca.findUnique({ where: { id: cobranca.id } });
      const pagoEmOriginal = apósPrimeira?.pagoEm?.getTime();
      expect(pagoEmOriginal).toBeDefined();

      const segunda = await request(app.getHttpServer())
        .post('/webhooks/asaas')
        .set('asaas-access-token', WEBHOOK_TOKEN)
        .send(payload);
      expect(segunda.status).toBe(200);

      const apósSegunda = await prisma.cobranca.findUnique({ where: { id: cobranca.id } });
      expect(apósSegunda?.status).toBe('PAGO');
      expect(apósSegunda?.pagoEm?.getTime()).toBe(pagoEmOriginal);

      const total = await prisma.cobranca.count({
        where: { idExternoGateway: 'pay_webhook_idempotencia' },
      });
      expect(total).toBe(1);
    });

    it('rejeita webhook com token inválido e não altera nenhum dado', async () => {
      const cobranca = await prisma.cobranca.create({
        data: {
          unidadeId: fixtures.unidade1.id,
          valor: 300,
          vencimento: new Date(),
          status: 'PENDENTE',
          idExternoGateway: 'pay_webhook_token_invalido',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/webhooks/asaas')
        .set('asaas-access-token', 'token-completamente-errado')
        .send({
          event: 'PAYMENT_CONFIRMED',
          payment: { id: 'pay_webhook_token_invalido', status: 'CONFIRMED' },
        });

      expect(res.status).toBe(401);

      const inalterada = await prisma.cobranca.findUnique({ where: { id: cobranca.id } });
      expect(inalterada?.status).toBe('PENDENTE');
      expect(inalterada?.pagoEm).toBeNull();
    });

    it('rejeita webhook sem o header de token', async () => {
      const res = await request(app.getHttpServer())
        .post('/webhooks/asaas')
        .send({ event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_qualquer', status: 'CONFIRMED' } });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /condominios/:condominioId/financeiro/resumo', () => {
    it('retorna os totais corretos a partir de cobranças com status variados', async () => {
      await prisma.cobranca.deleteMany({
        where: { unidade: { condominioId: fixtures.condominio1.id } },
      });

      const unidadeExtra = await prisma.unidade.create({
        data: { condominioId: fixtures.condominio1.id, identificador: '102', tipo: 'apartamento' },
      });

      const hoje = new Date();
      // Datas de atraso são fixadas no mês ANTERIOR ao atual (não "N dias
      // atrás"), pra não cair de volta no mês corrente dependendo do dia em
      // que o teste rodar — isso isola "atrasado" de "vence neste mês".
      const primeiroDiaMesPassado = new Date(
        Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1),
      );
      const decimoDiaMesPassado = new Date(
        Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 10),
      );

      // pendente, vence hoje (ainda dentro do mês, não atrasada) -> entra em totalAReceberNoMes
      await prisma.cobranca.create({
        data: { unidadeId: fixtures.unidade1.id, valor: 500, vencimento: hoje, status: 'PENDENTE' },
      });
      // paga hoje -> entra em totalRecebido, não em totalAReceberNoMes
      await prisma.cobranca.create({
        data: {
          unidadeId: fixtures.unidade1.id,
          valor: 300,
          vencimento: hoje,
          status: 'PAGO',
          pagoEm: hoje,
        },
      });
      // pendente vencida no mês passado -> inadimplente, fora de totalAReceberNoMes (não vence neste mês)
      await prisma.cobranca.create({
        data: {
          unidadeId: unidadeExtra.id,
          valor: 400,
          vencimento: decimoDiaMesPassado,
          status: 'PENDENTE',
        },
      });
      // status ATRASADO explícito, mais antiga ainda
      await prisma.cobranca.create({
        data: {
          unidadeId: unidadeExtra.id,
          valor: 150,
          vencimento: primeiroDiaMesPassado,
          status: 'ATRASADO',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio1.id}/financeiro/resumo`)
        .set('Authorization', `Bearer ${tokenSindico}`);

      expect(res.status).toBe(200);
      expect(res.body.totalAReceberNoMes).toBe(500);
      expect(res.body.totalRecebido).toBe(300);

      const inadimplentes = res.body.unidadesInadimplentes as Array<{
        unidadeId: string;
        diasAtraso: number;
      }>;
      expect(inadimplentes).toHaveLength(1);
      expect(inadimplentes[0].unidadeId).toBe(unidadeExtra.id);
      expect(inadimplentes[0].diasAtraso).toBeGreaterThanOrEqual(28);
    });
  });
});
