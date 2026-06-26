import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { R2_CLIENT, R2Client } from './storage/r2-client.interface';
import { CriarUploadUrlDto } from './dto/criar-upload-url.dto';

const DOWNLOAD_URL_EXPIRES_IN_SECONDS = 5 * 60;

function sanitizarNomeArquivo(nomeArquivo: string): string {
  return nomeArquivo.replace(/[^a-zA-Z0-9._-]/g, '_');
}

@Injectable()
export class DocumentosService {
  constructor(@Inject(R2_CLIENT) private readonly r2Client: R2Client) {}

  async criarUrlUpload(
    condominioId: string,
    dto: CriarUploadUrlDto,
    tenantPrisma: TenantPrismaClient,
  ) {
    const key = `documentos/${condominioId}/${randomUUID()}-${sanitizarNomeArquivo(dto.nomeArquivo)}`;

    const { url } = await this.r2Client.gerarUrlUpload({ key, contentType: dto.contentType });

    const documento = await tenantPrisma.documento.create({
      data: { condominioId, tipo: dto.tipo, visibilidade: dto.visibilidade, urlArquivo: key },
    });

    return { uploadUrl: url, documento };
  }

  /**
   * ADMINISTRADORA e SINDICO (do próprio condomínio) veem todos os
   * documentos. CONDOMINO só vê os de visibilidade TODOS — documentos
   * SINDICO_ADMINISTRADORA (ex: prestação de contas) ficam de fora mesmo
   * que o vínculo dele autorize o acesso à rota (nível condomínio).
   */
  async listar(condominioId: string, usuario: AuthenticatedUser, tenantPrisma: TenantPrismaClient) {
    const vinculoAmplo = await this.temAcessoAmplo(usuario, condominioId, tenantPrisma);

    return tenantPrisma.documento.findMany({
      where: { condominioId, ...(vinculoAmplo ? {} : { visibilidade: 'TODOS' }) },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async obterUrlDownload(
    documentoId: string,
    usuario: AuthenticatedUser,
    tenantPrisma: TenantPrismaClient,
  ) {
    const documento = await tenantPrisma.documento.findUnique({ where: { id: documentoId } });
    if (!documento) {
      throw new NotFoundException('Documento não encontrado.');
    }

    if (documento.visibilidade === 'SINDICO_ADMINISTRADORA') {
      const vinculoAmplo = await this.temAcessoAmplo(usuario, documento.condominioId, tenantPrisma);
      if (!vinculoAmplo) {
        throw new ForbiddenException('Você não tem permissão para acessar este documento.');
      }
    }

    const url = await this.r2Client.gerarUrlDownload(
      documento.urlArquivo,
      DOWNLOAD_URL_EXPIRES_IN_SECONDS,
    );

    return { url, expiraEmSegundos: DOWNLOAD_URL_EXPIRES_IN_SECONDS };
  }

  private async temAcessoAmplo(
    usuario: AuthenticatedUser,
    condominioId: string,
    tenantPrisma: TenantPrismaClient,
  ): Promise<boolean> {
    const temVinculoAdministradora = usuario.vinculos.some(
      (vinculo) => vinculo.papel === 'ADMINISTRADORA',
    );
    // Só busca o condomínio se houver um vínculo ADMINISTRADORA a verificar —
    // evita a query extra no caso comum (SINDICO já resolve por condominioId
    // direto, sem precisar saber a administradoraId).
    const administradoraIdDoCondominio = temVinculoAdministradora
      ? (await tenantPrisma.condominio.findUnique({ where: { id: condominioId } }))
          ?.administradoraId
      : undefined;

    return usuario.vinculos.some((vinculo) => {
      if (vinculo.papel === 'SINDICO') {
        return vinculo.condominioId === condominioId;
      }
      if (vinculo.papel === 'ADMINISTRADORA') {
        return vinculo.administradoraId === administradoraIdDoCondominio;
      }
      return false;
    });
  }
}
