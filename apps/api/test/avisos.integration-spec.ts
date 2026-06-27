import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EMAIL_CLIENT } from '../src/avisos/email/email-client.interface';
import { WHATSAPP_CLIENT } from '../src/avisos/whatsapp/whatsapp-client.interface';
import { limparBanco } from './helpers/cleanup-database';
import { criarFixtures, SENHA_PLANA } from './helpers/auth-fixtures';
import { FakeEmailClient } from './helpers/fake-email-client';
import { FakeWhatsappClient } from './helpers/fake-whatsapp-client';

describe('Módulo avisos', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeEmail: FakeEmailClient;
  let fakeWhatsapp: FakeWhatsappClient;
  let fixtures: Awaited<ReturnType<typeof criarFixtures>>;
  let unidade3: { id: string };
  let usuarioCondomino3: { id: string; email: string };
  let tokenSindico: string;
  let tokenCondomino: string;
  let tokenCondomino3: string;
  let tokenAdministradora: string;

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, senha: SENHA_PLANA });
    return res.body.accessToken;
  }

  beforeAll(async () => {
    fakeEmail = new FakeEmailClient();
    fakeWhatsapp = new FakeWhatsappClient();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMAIL_CLIENT)
      .useValue(fakeEmail)
      .overrideProvider(WHATSAPP_CLIENT)
      .useValue(fakeWhatsapp)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);
    await limparBanco(prisma);
    fixtures = await criarFixtures(prisma);

    unidade3 = await prisma.unidade.create({
      data: { condominioId: fixtures.condominio1.id, identificador: '303', tipo: 'apartamento' },
    });
    const senhaHash = await bcrypt.hash(SENHA_PLANA, 10);
    usuarioCondomino3 = await prisma.usuario.create({
      data: { nome: 'Condômino Unidade 3', email: 'condomino3@example.com', senhaHash },
    });
    await prisma.vinculoUsuario.create({
      data: { usuarioId: usuarioCondomino3.id, papel: 'CONDOMINO', unidadeId: unidade3.id },
    });

    tokenSindico = await login(fixtures.usuarioSindico.email);
    tokenCondomino = await login(fixtures.usuarioCondomino.email);
    tokenCondomino3 = await login(usuarioCondomino3.email);
    tokenAdministradora = await login(fixtures.usuarioAdministradora.email);
  });

  afterAll(async () => {
    await limparBanco(prisma);
    await app.close();
  });

  beforeEach(() => {
    fakeEmail.chamadas = [];
    fakeWhatsapp.chamadas = [];
  });

  describe('POST /condominios/:condominioId/avisos', () => {
    it('cria o aviso e dispara o envio pelos canais APP, EMAIL e WHATSAPP', async () => {
      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/avisos`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({
          titulo: 'Assembleia geral',
          corpo: 'Assembleia no salão de festas dia 10.',
          canais: ['APP', 'EMAIL', 'WHATSAPP'],
        });

      expect(res.status).toBe(201);
      expect(res.body.titulo).toBe('Assembleia geral');
      expect(res.body.canais).toEqual(['APP', 'EMAIL', 'WHATSAPP']);

      // EMAIL: síndico e condômino da unidade1 recebem, com o nome da
      // Administradora como remetente (co-branding).
      const destinatariosEmail = fakeEmail.chamadas.map((c) => c.destinatarioEmail);
      expect(destinatariosEmail).toEqual(
        expect.arrayContaining([fixtures.usuarioSindico.email, fixtures.usuarioCondomino.email]),
      );
      expect(fakeEmail.chamadas.every((c) => c.remetenteNome === 'Administradora 1')).toBe(true);

      // WHATSAPP: chama o stub sem lançar erro (201 já garante isso), e
      // registra a chamada com o aviso criado.
      expect(fakeWhatsapp.chamadas).toHaveLength(1);
      expect(fakeWhatsapp.chamadas[0].id).toBe(res.body.id);

      // APP: AvisoLeitura criada como não lida para síndico e condômino.
      const leituras = await prisma.avisoLeitura.findMany({ where: { avisoId: res.body.id } });
      const usuarioIds = leituras.map((l) => l.usuarioId);
      expect(usuarioIds).toEqual(
        expect.arrayContaining([fixtures.usuarioSindico.id, fixtures.usuarioCondomino.id]),
      );
      expect(leituras.every((l) => l.lidoEm === null)).toBe(true);
    });

    it('escopo de unidade específica só notifica o condômino daquela unidade', async () => {
      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/avisos`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({
          titulo: 'Aviso individual',
          corpo: 'Sua encomenda chegou na portaria.',
          canais: ['APP'],
          unidadeId: fixtures.unidade1.id,
        });

      expect(res.status).toBe(201);

      const leituras = await prisma.avisoLeitura.findMany({ where: { avisoId: res.body.id } });
      const usuarioIds = leituras.map((l) => l.usuarioId);
      expect(usuarioIds).toEqual([fixtures.usuarioCondomino.id]);
      expect(usuarioIds).not.toContain(usuarioCondomino3.id);
      expect(usuarioIds).not.toContain(fixtures.usuarioSindico.id);
    });

    it('rejeita com 403 quando um condômino tenta criar um aviso', async () => {
      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/avisos`)
        .set('Authorization', `Bearer ${tokenCondomino}`)
        .send({ titulo: 'x', corpo: 'y', canais: ['APP'] });

      expect(res.status).toBe(403);
    });

    it('NÃO permite criar aviso em condomínio de outro tenant', async () => {
      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio2.id}/avisos`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ titulo: 'x', corpo: 'y', canais: ['APP'] });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /usuarios/me/avisos', () => {
    it('lista o aviso não lido apenas para os usuários dentro do escopo certo', async () => {
      const avisoCondominioInteiro = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/avisos`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({
          titulo: 'Manutenção do elevador',
          corpo: 'Elevador em manutenção.',
          canais: ['APP'],
        });
      expect(avisoCondominioInteiro.status).toBe(201);

      const resCondomino = await request(app.getHttpServer())
        .get('/usuarios/me/avisos')
        .set('Authorization', `Bearer ${tokenCondomino}`);
      expect(resCondomino.status).toBe(200);
      expect(resCondomino.body.map((a: { id: string }) => a.id)).toContain(
        avisoCondominioInteiro.body.id,
      );

      const resSindico = await request(app.getHttpServer())
        .get('/usuarios/me/avisos')
        .set('Authorization', `Bearer ${tokenSindico}`);
      expect(resSindico.body.map((a: { id: string }) => a.id)).toContain(
        avisoCondominioInteiro.body.id,
      );

      // Condômino de outra unidade do mesmo condomínio não é destinatário
      // deste aviso (escopo "unidade específica" testado separadamente),
      // mas TAMBÉM não deveria ver avisos de unidade que não é a dele.
      const avisoUnidadeEspecifica = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/avisos`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({
          titulo: 'Aviso só da unidade 1',
          corpo: 'x',
          canais: ['APP'],
          unidadeId: fixtures.unidade1.id,
        });

      const resCondomino3 = await request(app.getHttpServer())
        .get('/usuarios/me/avisos')
        .set('Authorization', `Bearer ${tokenCondomino3}`);
      expect(resCondomino3.body.map((a: { id: string }) => a.id)).not.toContain(
        avisoUnidadeEspecifica.body.id,
      );

      // ADMINISTRADORA não é destinatário de avisos (decisão de escopo) —
      // não aparece na própria caixa de não lidos.
      const resAdministradora = await request(app.getHttpServer())
        .get('/usuarios/me/avisos')
        .set('Authorization', `Bearer ${tokenAdministradora}`);
      expect(resAdministradora.status).toBe(200);
      expect(resAdministradora.body.map((a: { id: string }) => a.id)).not.toContain(
        avisoCondominioInteiro.body.id,
      );
    });

    it('NÃO grava AvisoLeitura (nem aparece como não lido) quando o canal APP não é selecionado', async () => {
      const aviso = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/avisos`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({ titulo: 'Só e-mail', corpo: 'x', canais: ['EMAIL'] });
      expect(aviso.status).toBe(201);

      const leituras = await prisma.avisoLeitura.findMany({ where: { avisoId: aviso.body.id } });
      expect(leituras).toHaveLength(0);

      const resCondomino = await request(app.getHttpServer())
        .get('/usuarios/me/avisos')
        .set('Authorization', `Bearer ${tokenCondomino}`);
      expect(resCondomino.body.map((a: { id: string }) => a.id)).not.toContain(aviso.body.id);
    });
  });
});
