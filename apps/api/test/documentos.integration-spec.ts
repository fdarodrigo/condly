import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { R2_CLIENT } from '../src/documentos/storage/r2-client.interface';
import { limparBanco } from './helpers/cleanup-database';
import { criarFixtures, SENHA_PLANA } from './helpers/auth-fixtures';
import { FakeR2Client } from './helpers/fake-r2-client';

describe('Módulo documentos', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeR2: FakeR2Client;
  let fixtures: Awaited<ReturnType<typeof criarFixtures>>;
  let tokenSindico: string;
  let tokenCondomino: string;

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, senha: SENHA_PLANA });
    return res.body.accessToken;
  }

  beforeAll(async () => {
    fakeR2 = new FakeR2Client();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(R2_CLIENT)
      .useValue(fakeR2)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);
    await limparBanco(prisma);
    fixtures = await criarFixtures(prisma);

    tokenSindico = await login(fixtures.usuarioSindico.email);
    tokenCondomino = await login(fixtures.usuarioCondomino.email);
  });

  afterAll(async () => {
    await limparBanco(prisma);
    await app.close();
  });

  describe('POST /condominios/:condominioId/documentos/upload-url', () => {
    it('gera a signed URL de upload e cria o registro de Documento', async () => {
      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/documentos/upload-url`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({
          tipo: 'ata',
          visibilidade: 'TODOS',
          nomeArquivo: 'ata-assembleia.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body.uploadUrl).toMatch(/^https:\/\/fake-r2\.example\.com\/upload\//);
      expect(res.body.documento.tipo).toBe('ata');
      expect(res.body.documento.visibilidade).toBe('TODOS');
      expect(res.body.documento.condominioId).toBe(fixtures.condominio1.id);

      const ultimaChamada = fakeR2.chamadasUpload[fakeR2.chamadasUpload.length - 1];
      expect(ultimaChamada.contentType).toBe('application/pdf');
      expect(ultimaChamada.key).toMatch(new RegExp(`^documentos/${fixtures.condominio1.id}/`));
      expect(ultimaChamada.key).toMatch(/ata-assembleia\.pdf$/);

      const naBase = await prisma.documento.findUnique({ where: { id: res.body.documento.id } });
      expect(naBase).not.toBeNull();
      expect(naBase?.urlArquivo).toBe(ultimaChamada.key);
    });

    it('rejeita com 403 quando um condômino tenta gerar a URL de upload', async () => {
      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/documentos/upload-url`)
        .set('Authorization', `Bearer ${tokenCondomino}`)
        .send({
          tipo: 'ata',
          visibilidade: 'TODOS',
          nomeArquivo: 'documento.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(403);
    });

    it('NÃO permite gerar URL de upload para um condomínio de outro tenant', async () => {
      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio2.id}/documentos/upload-url`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({
          tipo: 'ata',
          visibilidade: 'TODOS',
          nomeArquivo: 'documento.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(403);
    });

    it('rejeita com 400 um contentType fora da lista permitida', async () => {
      const res = await request(app.getHttpServer())
        .post(`/condominios/${fixtures.condominio1.id}/documentos/upload-url`)
        .set('Authorization', `Bearer ${tokenSindico}`)
        .send({
          tipo: 'ata',
          visibilidade: 'TODOS',
          nomeArquivo: 'script.html',
          contentType: 'text/html',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /condominios/:condominioId/documentos', () => {
    it('condômino NÃO vê documento com visibilidade restrita a síndico/administradora', async () => {
      await prisma.documento.create({
        data: {
          condominioId: fixtures.condominio1.id,
          tipo: 'ata',
          visibilidade: 'TODOS',
          urlArquivo: 'documentos/fixture/ata.pdf',
        },
      });
      await prisma.documento.create({
        data: {
          condominioId: fixtures.condominio1.id,
          tipo: 'prestacao_contas',
          visibilidade: 'SINDICO_ADMINISTRADORA',
          urlArquivo: 'documentos/fixture/prestacao.pdf',
        },
      });

      const resSindico = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio1.id}/documentos`)
        .set('Authorization', `Bearer ${tokenSindico}`);
      expect(resSindico.status).toBe(200);
      const tiposSindico = resSindico.body.map((doc: { tipo: string }) => doc.tipo);
      expect(tiposSindico).toEqual(expect.arrayContaining(['ata', 'prestacao_contas']));

      const resCondomino = await request(app.getHttpServer())
        .get(`/condominios/${fixtures.condominio1.id}/documentos`)
        .set('Authorization', `Bearer ${tokenCondomino}`);
      expect(resCondomino.status).toBe(200);
      const tiposCondomino = resCondomino.body.map((doc: { tipo: string }) => doc.tipo);
      expect(tiposCondomino).toContain('ata');
      expect(tiposCondomino).not.toContain('prestacao_contas');
    });
  });

  describe('GET /documentos/:documentoId/download-url', () => {
    it('gera a URL de download com expiração de 5 minutos (300s), sem depender do tempo real', async () => {
      const documento = await prisma.documento.create({
        data: {
          condominioId: fixtures.condominio1.id,
          tipo: 'ata',
          visibilidade: 'TODOS',
          urlArquivo: 'documentos/fixture/ata-download.pdf',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/documentos/${documento.id}/download-url`)
        .set('Authorization', `Bearer ${tokenCondomino}`);

      expect(res.status).toBe(200);
      expect(res.body.expiraEmSegundos).toBe(300);
      expect(typeof res.body.url).toBe('string');

      const ultimaChamada = fakeR2.chamadasDownload[fakeR2.chamadasDownload.length - 1];
      expect(ultimaChamada.key).toBe(documento.urlArquivo);
      expect(ultimaChamada.expiresInSeconds).toBe(300);
    });

    it('rejeita com 403 um condômino baixando documento restrito a síndico/administradora', async () => {
      const documento = await prisma.documento.create({
        data: {
          condominioId: fixtures.condominio1.id,
          tipo: 'prestacao_contas',
          visibilidade: 'SINDICO_ADMINISTRADORA',
          urlArquivo: 'documentos/fixture/prestacao-download.pdf',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/documentos/${documento.id}/download-url`)
        .set('Authorization', `Bearer ${tokenCondomino}`);

      expect(res.status).toBe(403);
    });

    it('permite ao síndico baixar documento restrito a síndico/administradora', async () => {
      const documento = await prisma.documento.create({
        data: {
          condominioId: fixtures.condominio1.id,
          tipo: 'prestacao_contas',
          visibilidade: 'SINDICO_ADMINISTRADORA',
          urlArquivo: 'documentos/fixture/prestacao-sindico.pdf',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/documentos/${documento.id}/download-url`)
        .set('Authorization', `Bearer ${tokenSindico}`);

      expect(res.status).toBe(200);
    });

    it('NÃO permite baixar documento de outro tenant (isolamento multi-tenant)', async () => {
      const documentoOutroTenant = await prisma.documento.create({
        data: {
          condominioId: fixtures.condominio2.id,
          tipo: 'ata',
          visibilidade: 'TODOS',
          urlArquivo: 'documentos/fixture/ata-outro-tenant.pdf',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/documentos/${documentoOutroTenant.id}/download-url`)
        .set('Authorization', `Bearer ${tokenCondomino}`);

      expect(res.status).toBe(403);
    });
  });
});
