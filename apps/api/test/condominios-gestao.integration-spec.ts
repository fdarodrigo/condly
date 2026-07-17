import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from './helpers/cleanup-database';
import { criarFixtures, SENHA_PLANA } from './helpers/auth-fixtures';

/**
 * Gestão do condomínio pelo SINDICO (perfil): mesmas ações da ADMINISTRADORA
 * dentro do próprio condomínio — editar dados cadastrais, gerenciar membros e
 * unidades — MENOS: excluir o condomínio e alterar as próprias permissões
 * (permissoesSindico), que continuam exclusivas da ADMINISTRADORA.
 */
describe('Gestão de condomínio — SINDICO vs ADMINISTRADORA', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixtures: Awaited<ReturnType<typeof criarFixtures>>;
  let tokenSindico: string;
  let tokenAdministradora: string;
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

    tokenSindico = await login(fixtures.usuarioSindico.email);
    tokenAdministradora = await login(fixtures.usuarioAdministradora.email);
    tokenCondomino = await login(fixtures.usuarioCondomino.email);
  });

  afterAll(async () => {
    await limparBanco(prisma);
    await app.close();
  });

  describe('PATCH /condominios/:condominioId', () => {
    it('síndico edita os dados cadastrais do próprio condomínio (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/condominios/${fixtures.condominio1.id}`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ telefone: '11 4002-8922', email: 'contato@condominio1.example.com' });

      expect(res.status).toBe(200);
      expect(res.body.telefone).toBe('11 4002-8922');
      expect(res.body.email).toBe('contato@condominio1.example.com');
    });

    it('síndico NÃO altera as próprias permissões (403) e nada é gravado', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/condominios/${fixtures.condominio1.id}`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ permissoesSindico: { avisosCriar: true, chamadosExcluir: true } });

      expect(res.status).toBe(403);

      const cond = await prisma.condominio.findUnique({
        where: { id: fixtures.condominio1.id },
      });
      expect(cond?.permissoesSindico).toBeNull();
    });

    it('administradora continua podendo alterar as permissões do síndico (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/condominios/${fixtures.condominio1.id}`)
        .set('Authorization', `Bearer ${tokenAdministradora}`)
        .send({ permissoesSindico: { avisosCriar: false } });

      expect(res.status).toBe(200);
      expect(res.body.permissoesSindico.avisosCriar).toBe(false);

      // restaura pra não interferir nos outros testes
      await request(app.getHttpServer())
        .patch(`/condominios/${fixtures.condominio1.id}`)
        .set('Authorization', `Bearer ${tokenAdministradora}`)
        .send({ permissoesSindico: { avisosCriar: true } });
    });

    it('síndico que administra OUTRA carteira também não altera as próprias permissões (403)', async () => {
      // Cenário de papel duplo: SINDICO do condominio1 (administradora1) que
      // também é ADMINISTRADORA da administradora2 — ter "algum" vínculo
      // ADMINISTRADORA não pode bastar pra editar permissoesSindico de um
      // condomínio de outra carteira.
      const senhaHash = fixtures.usuarioSindico.senhaHash;
      const duplo = await prisma.usuario.create({
        data: { nome: 'Síndico e ADM de outra carteira', email: 'duplo@example.com', senhaHash },
      });
      await prisma.vinculoUsuario.create({
        data: { usuarioId: duplo.id, papel: 'SINDICO', condominioId: fixtures.condominio1.id },
      });
      await prisma.vinculoUsuario.create({
        data: {
          usuarioId: duplo.id,
          papel: 'ADMINISTRADORA',
          administradoraId: fixtures.administradora2.id,
        },
      });
      const tokenDuplo = await login('duplo@example.com');

      const res = await request(app.getHttpServer())
        .patch(`/condominios/${fixtures.condominio1.id}`)
        .set('Authorization', `Bearer ${tokenDuplo}`)
        .send({ permissoesSindico: { avisosCriar: true } });

      expect(res.status).toBe(403);

      // dados cadastrais continuam liberados pra ele (é síndico legítimo daqui)
      const cadastral = await request(app.getHttpServer())
        .patch(`/condominios/${fixtures.condominio1.id}`)
        .set('Authorization', `Bearer ${tokenDuplo}`)
        .send({ telefone: '11 3000-0000' });
      expect(cadastral.status).toBe(200);
    });

    it('síndico NÃO edita condomínio de outro tenant (403)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/condominios/${fixtures.condominio2.id}`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ telefone: '11 99999-0000' });

      expect(res.status).toBe(403);
    });

    it('síndico NÃO exclui o próprio condomínio (403)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/condominios/${fixtures.condominio1.id}`)
        .set('Authorization', `Bearer ${tokenSindico}`);

      expect(res.status).toBe(403);
    });
  });

  describe('membros (/condominios/:condominioId/membros)', () => {
    it('síndico lista os membros do próprio condomínio (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio1.id}/membros`)
        .set('Authorization', `Bearer ${tokenSindico}`);

      expect(res.status).toBe(200);
      const emails = res.body.map((m: { email: string }) => m.email);
      expect(emails).toContain(fixtures.usuarioSindico.email);
      expect(emails).toContain(fixtures.usuarioCondomino.email);
    });

    it('condômino NÃO lista membros (403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio1.id}/membros`)
        .set('Authorization', `Bearer ${tokenCondomino}`);

      expect(res.status).toBe(403);
    });

    it('síndico adiciona condômino, e o vínculo herda a administradora do condomínio', async () => {
      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/membros`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({
          email: 'novo.condomino@example.com',
          nome: 'Novo Condômino',
          senha: 'Senha123!',
          papel: 'CONDOMINO',
          unidadeId: fixtures.unidade1.id,
        });

      expect(res.status).toBe(201);

      const vinculo = await prisma.vinculoUsuario.findFirst({
        where: { usuarioId: res.body.usuarioId, condominioId: fixtures.condominio1.id },
      });
      expect(vinculo?.papel).toBe('CONDOMINO');
      // O síndico não tem administradoraId no próprio vínculo — o valor deve
      // vir do Condominio, nunca ficar vazio/órfão.
      expect(vinculo?.administradoraId).toBe(fixtures.administradora1.id);
    });

    it('síndico NÃO adiciona membro em condomínio de outro tenant (403)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio2.id}/membros`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({
          email: 'intruso@example.com',
          nome: 'Intruso',
          senha: 'Senha123!',
          papel: 'CONDOMINO',
          unidadeId: fixtures.unidade2.id,
        });

      expect(res.status).toBe(403);
    });

    it('síndico remove um membro do próprio condomínio (204)', async () => {
      const usuario = await prisma.usuario.findUnique({
        where: { email: 'novo.condomino@example.com' },
      });
      const res = await request(app.getHttpServer())
        .delete(`/condominios/${fixtures.condominio1.id}/membros/${usuario!.id}`)
        .set('Authorization', `Bearer ${tokenSindico}`);

      expect(res.status).toBe(204);

      const vinculo = await prisma.vinculoUsuario.findFirst({
        where: { usuarioId: usuario!.id, condominioId: fixtures.condominio1.id },
      });
      expect(vinculo).toBeNull();
    });
  });

  describe('unidades', () => {
    it('síndico cria e exclui unidade no próprio condomínio', async () => {
      const criada = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/unidades`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ identificador: '999', tipo: 'APARTAMENTO' });

      expect(criada.status).toBe(201);
      expect(criada.body.condominioId).toBe(fixtures.condominio1.id);

      const removida = await request(app.getHttpServer())
        .delete(`/unidades/${criada.body.id}`)
        .set('Authorization', `Bearer ${tokenSindico}`);

      expect(removida.status).toBe(204);
    });

    it('síndico NÃO cria unidade em condomínio de outro tenant (403)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio2.id}/unidades`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ identificador: '888', tipo: 'APARTAMENTO' });

      expect(res.status).toBe(403);
    });

    it('condômino NÃO cria unidade (403)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/unidades`)
        .set('Authorization', `Bearer ${tokenCondomino}`)
        .send({ identificador: '777', tipo: 'APARTAMENTO' });

      expect(res.status).toBe(403);
    });
  });
});
