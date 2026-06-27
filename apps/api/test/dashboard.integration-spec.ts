import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from './helpers/cleanup-database';
import { criarFixtures, SENHA_PLANA } from './helpers/auth-fixtures';

function diaDoMes(base: Date, dia: number): Date {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), dia));
}

// Último dia do mês de `base` (dia 0 do mês seguinte, em UTC) — único dia
// garantido a ser "neste mês" e "ainda não vencido" independente de em
// que dia do mês o teste de fato roda (diferente de um dia fixo como o
// 5, que vira "vencido" se o teste rodar depois do dia 5).
function ultimoDiaDoMes(base: Date): Date {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));
}

describe('Módulo dashboard', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixtures: Awaited<ReturnType<typeof criarFixtures>>;
  let tokenAdministradora: string;
  let tokenSindico: string;
  let tokenCondomino: string;

  // Cenário conhecido: 3 condomínios sob a mesma administradora, com
  // arrecadação/inadimplência/chamados controlados manualmente.
  let condominioA: { id: string };
  let condominioB: { id: string };
  let condominioC: { id: string };
  let unidadeB1: { id: string };

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

    const agora = new Date();

    condominioA = await prisma.condominio.create({
      data: {
        administradoraId: fixtures.administradora1.id,
        nome: 'Condomínio A (boa arrecadação)',
        endereco: 'Rua A',
        cnpj: '10.000.000/0001-01',
      },
    });
    condominioB = await prisma.condominio.create({
      data: {
        administradoraId: fixtures.administradora1.id,
        nome: 'Condomínio B (inadimplente)',
        endereco: 'Rua B',
        cnpj: '10.000.000/0001-02',
      },
    });
    condominioC = await prisma.condominio.create({
      data: {
        administradoraId: fixtures.administradora1.id,
        nome: 'Condomínio C (sem movimento)',
        endereco: 'Rua C',
        cnpj: '10.000.000/0001-03',
      },
    });

    const unidadeA1 = await prisma.unidade.create({
      data: { condominioId: condominioA.id, identificador: 'A1', tipo: 'apartamento' },
    });
    unidadeB1 = await prisma.unidade.create({
      data: { condominioId: condominioB.id, identificador: 'B1', tipo: 'apartamento' },
    });

    // Condomínio A: R$1000 vencendo neste mês, já pago neste mês — 100% de
    // arrecadação, zero em atraso.
    await prisma.cobranca.create({
      data: {
        unidadeId: unidadeA1.id,
        valor: 1000,
        vencimento: diaDoMes(agora, 5),
        status: 'PAGO',
        pagoEm: diaDoMes(agora, 3),
      },
    });
    await prisma.chamado.create({
      data: {
        condominioId: condominioA.id,
        abertoPorId: fixtures.usuarioSindico.id,
        categoria: 'manutenção',
        status: 'ABERTO',
      },
    });

    // Condomínio B: R$2000 vencendo neste mês, NADA pago (0% de
    // arrecadação) + R$300 já marcado ATRASADO (vencimento bem no passado,
    // fora do mês atual, pra não contaminar o "a receber no mês"). 3
    // chamados pendentes (2 ABERTO + 1 EM_ANDAMENTO).
    await prisma.cobranca.create({
      data: {
        unidadeId: unidadeB1.id,
        valor: 2000,
        vencimento: ultimoDiaDoMes(agora),
        status: 'PENDENTE',
      },
    });
    await prisma.cobranca.create({
      data: {
        unidadeId: unidadeB1.id,
        valor: 300,
        vencimento: new Date(Date.UTC(2020, 0, 1)),
        status: 'ATRASADO',
      },
    });
    await prisma.chamado.createMany({
      data: [
        {
          condominioId: condominioB.id,
          abertoPorId: fixtures.usuarioSindico.id,
          categoria: 'x',
          status: 'ABERTO',
        },
        {
          condominioId: condominioB.id,
          abertoPorId: fixtures.usuarioSindico.id,
          categoria: 'y',
          status: 'ABERTO',
        },
        {
          condominioId: condominioB.id,
          abertoPorId: fixtures.usuarioSindico.id,
          categoria: 'z',
          status: 'EM_ANDAMENTO',
        },
      ],
    });
    // Um chamado RESOLVIDO em B não deve contar como pendente.
    await prisma.chamado.create({
      data: {
        condominioId: condominioB.id,
        abertoPorId: fixtures.usuarioSindico.id,
        categoria: 'resolvido',
        status: 'RESOLVIDO',
      },
    });

    // Condomínio C: nenhuma cobrança, nenhum chamado — caso de borda
    // (taxaArrecadacao deve ser null, não 0, e não pode quebrar o ranking).

    // Serviço periódico e reserva pra exercitar o dashboard por condomínio.
    await prisma.servicoPeriodico.create({
      data: {
        condominioId: condominioB.id,
        nome: 'Manutenção do elevador',
        proximoVencimento: new Date(Date.now() + 10 * 86_400_000),
      },
    });
    await prisma.servicoPeriodico.create({
      data: {
        condominioId: condominioB.id,
        nome: 'Dedetização',
        proximoVencimento: new Date(Date.now() + 3 * 86_400_000),
      },
    });
    await prisma.servicoPeriodico.create({
      data: {
        condominioId: condominioB.id,
        nome: 'Vencido',
        proximoVencimento: new Date(Date.now() - 30 * 86_400_000),
      },
    });

    const areaComumB = await prisma.areaComum.create({
      data: {
        condominioId: condominioB.id,
        nome: 'Salão',
        regrasReserva: {
          horarioAbertura: '08:00',
          horarioFechamento: '22:00',
          duracaoMinimaMinutos: 60,
          antecedenciaMaximaDias: 30,
        },
      },
    });
    await prisma.reserva.create({
      data: {
        areaComumId: areaComumB.id,
        unidadeId: unidadeB1.id,
        inicio: new Date(Date.now() + 2 * 86_400_000),
        fim: new Date(Date.now() + 2 * 86_400_000 + 3_600_000),
        status: 'CONFIRMADA',
      },
    });
    await prisma.reserva.create({
      data: {
        areaComumId: areaComumB.id,
        unidadeId: unidadeB1.id,
        inicio: new Date(Date.now() + 10 * 86_400_000),
        fim: new Date(Date.now() + 10 * 86_400_000 + 3_600_000),
        status: 'CONFIRMADA',
      },
    });

    tokenAdministradora = await login(fixtures.usuarioAdministradora.email);
    tokenSindico = await login(fixtures.usuarioSindico.email);
    tokenCondomino = await login(fixtures.usuarioCondomino.email);
  });

  afterAll(async () => {
    await limparBanco(prisma);
    await app.close();
  });

  describe('GET /condominios/:condominioId/dashboard', () => {
    it('retorna os totais financeiros, chamados por status, serviços e reservas do condomínio B', async () => {
      const res = await request(app.getHttpServer())
        .get(`/condominios/${condominioB.id}/dashboard`)
        .set('Authorization', `Bearer ${tokenSindico}`);

      // tokenSindico é vinculado a condominio1 (fixtures), não a
      // condominioB — usa tokenAdministradora, que é da mesma
      // administradora dos 3 condomínios do cenário.
      expect(res.status).toBe(403);

      const resAdmin = await request(app.getHttpServer())
        .get(`/condominios/${condominioB.id}/dashboard`)
        .set('Authorization', `Bearer ${tokenAdministradora}`);

      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.totalArrecadadoNoMes).toBe(0);
      expect(resAdmin.body.totalEmAtraso).toBe(300);
      expect(resAdmin.body.chamadosPorStatus).toEqual({
        PENDENTE_TRIAGEM: 0,
        ABERTO: 2,
        EM_ANDAMENTO: 1,
      });

      const nomesServicos = resAdmin.body.proximosVencimentosServicos.map(
        (s: { nome: string }) => s.nome,
      );
      expect(nomesServicos).toEqual(['Dedetização', 'Manutenção do elevador']);
      expect(nomesServicos).not.toContain('Vencido');

      expect(resAdmin.body.reservasProximos7Dias).toHaveLength(1);
      expect(resAdmin.body.reservasProximos7Dias[0].unidade.identificador).toBe('B1');
    });

    it('rejeita com 403 um condômino acessando o dashboard do condomínio', async () => {
      const res = await request(app.getHttpServer())
        .get(`/condominios/${condominioB.id}/dashboard`)
        .set('Authorization', `Bearer ${tokenCondomino}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /administradoras/:administradoraId/dashboard', () => {
    it('calcula ranking de arrecadação, inadimplência e chamados pendentes batendo com o cenário conhecido', async () => {
      const res = await request(app.getHttpServer())
        .get(`/administradoras/${fixtures.administradora1.id}/dashboard`)
        .set('Authorization', `Bearer ${tokenAdministradora}`);

      expect(res.status).toBe(200);

      const porId = (lista: Array<Record<string, unknown>>, id: string) =>
        lista.find((item) => item.condominioId === id)!;

      const arrecadacaoA = porId(res.body.rankingArrecadacao, condominioA.id);
      const arrecadacaoB = porId(res.body.rankingArrecadacao, condominioB.id);
      const arrecadacaoC = porId(res.body.rankingArrecadacao, condominioC.id);
      expect(arrecadacaoA.taxaArrecadacao).toBe(1);
      expect(arrecadacaoB.taxaArrecadacao).toBe(0);
      expect(arrecadacaoC.taxaArrecadacao).toBeNull();
      // A (100%) vem antes de B (0%) no ranking.
      const indiceA = res.body.rankingArrecadacao.findIndex(
        (i: { condominioId: string }) => i.condominioId === condominioA.id,
      );
      const indiceB = res.body.rankingArrecadacao.findIndex(
        (i: { condominioId: string }) => i.condominioId === condominioB.id,
      );
      expect(indiceA).toBeLessThan(indiceB);

      const inadimplenciaB = porId(res.body.rankingInadimplencia, condominioB.id);
      const inadimplenciaA = porId(res.body.rankingInadimplencia, condominioA.id);
      expect(inadimplenciaB.totalEmAtraso).toBe(300);
      expect(inadimplenciaA.totalEmAtraso).toBe(0);
      const indiceInadB = res.body.rankingInadimplencia.findIndex(
        (i: { condominioId: string }) => i.condominioId === condominioB.id,
      );
      const indiceInadA = res.body.rankingInadimplencia.findIndex(
        (i: { condominioId: string }) => i.condominioId === condominioA.id,
      );
      expect(indiceInadB).toBeLessThan(indiceInadA);

      // 1 (A) + 3 (B) + 0 (C) + 0 (condominio1, da fixture compartilhada,
      // também sob administradora1).
      expect(res.body.totalChamadosAbertos).toBe(4);

      // B (3) e A (1) têm contagens únicas, sem empate — posições 1 e 2 do
      // ranking são determinísticas. C empata em 0 com condominio1 (da
      // fixture compartilhada), então só checamos que ele aparece na lista
      // com o valor certo, sem fixar a posição exata do empate.
      expect(res.body.condominiosComMaisChamadosPendentes.slice(0, 2)).toEqual([
        expect.objectContaining({ condominioId: condominioB.id, chamadosPendentes: 3 }),
        expect.objectContaining({ condominioId: condominioA.id, chamadosPendentes: 1 }),
      ]);
      expect(res.body.condominiosComMaisChamadosPendentes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ condominioId: condominioC.id, chamadosPendentes: 0 }),
        ]),
      );
    });

    it('rejeita com 403 um síndico (mesmo de um condomínio da carteira) acessando o dashboard agregado', async () => {
      const res = await request(app.getHttpServer())
        .get(`/administradoras/${fixtures.administradora1.id}/dashboard`)
        .set('Authorization', `Bearer ${tokenSindico}`);

      expect(res.status).toBe(403);
    });

    it('NÃO permite acessar o dashboard agregado de outra administradora', async () => {
      const res = await request(app.getHttpServer())
        .get(`/administradoras/${fixtures.administradora2.id}/dashboard`)
        .set('Authorization', `Bearer ${tokenAdministradora}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Performance do dashboard agregado (sem N+1)', () => {
    it('dispara o mesmo número de queries com 3 ou com 100 condomínios na carteira', async () => {
      const senhaHash = await bcrypt.hash(SENHA_PLANA, 10);
      const administradoraGrande = await prisma.administradora.create({
        data: { nome: 'Administradora Grande', emailContato: 'grande@example.com' },
      });
      const usuarioAdminGrande = await prisma.usuario.create({
        data: { nome: 'Admin Grande', email: 'admin-grande@example.com', senhaHash },
      });
      await prisma.vinculoUsuario.create({
        data: {
          usuarioId: usuarioAdminGrande.id,
          papel: 'ADMINISTRADORA',
          administradoraId: administradoraGrande.id,
        },
      });
      const tokenAdminGrande = await login(usuarioAdminGrande.email);

      const condominios100 = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          prisma.condominio.create({
            data: {
              administradoraId: administradoraGrande.id,
              nome: `Condomínio Perf ${i}`,
              endereco: 'x',
              cnpj: `99.${String(i).padStart(3, '0')}.000/0001-${String(i).padStart(2, '0')}`,
            },
          }),
        ),
      );
      const unidades100 = await Promise.all(
        condominios100.map((c) =>
          prisma.unidade.create({
            data: { condominioId: c.id, identificador: 'U1', tipo: 'apartamento' },
          }),
        ),
      );
      await prisma.cobranca.createMany({
        data: unidades100.map((u) => ({
          unidadeId: u.id,
          valor: 100,
          vencimento: new Date(),
          status: 'PENDENTE' as const,
        })),
      });
      await prisma.chamado.createMany({
        data: condominios100.map((c) => ({
          condominioId: c.id,
          abertoPorId: fixtures.usuarioSindico.id,
          categoria: 'x',
          status: 'ABERTO' as const,
        })),
      });

      let queryCount = 0;
      prisma.onQuery(() => {
        queryCount += 1;
      });

      queryCount = 0;
      const resPequeno = await request(app.getHttpServer())
        .get(`/administradoras/${fixtures.administradora1.id}/dashboard`)
        .set('Authorization', `Bearer ${tokenAdministradora}`);
      expect(resPequeno.status).toBe(200);
      const queriesComPoucosCondominios = queryCount;

      queryCount = 0;
      const resGrande = await request(app.getHttpServer())
        .get(`/administradoras/${administradoraGrande.id}/dashboard`)
        .set('Authorization', `Bearer ${tokenAdminGrande}`);
      expect(resGrande.status).toBe(200);
      const queriesComCemCondominios = queryCount;

      expect(resGrande.body.totalChamadosAbertos).toBe(100);
      expect(resGrande.body.rankingArrecadacao).toHaveLength(100);

      // A prova de que não há N+1: o número de queries SQL disparadas não
      // cresce com o número de condomínios na carteira.
      expect(queriesComCemCondominios).toBe(queriesComPoucosCondominios);
      expect(queriesComCemCondominios).toBeLessThanOrEqual(6);

      // Isolamento: nenhum dos 100 condomínios da administradoraGrande
      // aparece no dashboard de administradora1, e vice-versa — os dois
      // cenários já estão montados nesta mesma chamada, então o teste de
      // performance também cobre esse ângulo sem custo extra de setup.
      const idsCondominios100 = new Set(condominios100.map((c) => c.id));
      const idsNoDashboardPequeno = resPequeno.body.rankingArrecadacao.map(
        (l: { condominioId: string }) => l.condominioId,
      );
      expect(idsNoDashboardPequeno.some((id: string) => idsCondominios100.has(id))).toBe(false);

      const idsDoCenarioPequeno = new Set([condominioA.id, condominioB.id, condominioC.id]);
      const idsNoDashboardGrande = resGrande.body.rankingArrecadacao.map(
        (l: { condominioId: string }) => l.condominioId,
      );
      expect(idsNoDashboardGrande.some((id: string) => idsDoCenarioPequeno.has(id))).toBe(false);
    }, 30_000);
  });
});
