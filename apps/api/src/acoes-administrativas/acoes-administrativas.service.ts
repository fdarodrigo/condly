import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { AvisosService } from '../avisos/avisos.service';
import { CriarAcaoAdministrativaDto } from './dto/criar-acao-administrativa.dto';

@Injectable()
export class AcoesAdministrativasService {
  constructor(private readonly avisosService: AvisosService) {}

  async listar(tenantPrisma: TenantPrismaClient) {
    return tenantPrisma.acaoAdministrativa.findMany({
      orderBy: { realizadaEm: 'desc' },
    });
  }

  async criar(
    condominioId: string,
    dto: CriarAcaoAdministrativaDto,
    tenantPrisma: TenantPrismaClient,
  ) {
    const acao = await tenantPrisma.acaoAdministrativa.create({
      data: {
        condominioId,
        titulo: dto.titulo,
        descricao: dto.descricao,
        realizadaEm: new Date(dto.realizadaEm),
        validoAte: dto.validoAte ? new Date(dto.validoAte) : null,
      },
    });

    if (dto.gerarAviso) {
      const validadeStr = dto.validoAte
        ? ` Válido até ${new Date(dto.validoAte).toLocaleDateString('pt-BR')}.`
        : '';
      await this.avisosService.criar(
        condominioId,
        {
          titulo: acao.titulo,
          corpo: `${dto.descricao ?? dto.titulo}${validadeStr}`,
          canais: ['APP'],
          unidadeId: undefined,
        },
        tenantPrisma,
      );
    }

    return acao;
  }

  async remover(acaoId: string, tenantPrisma: TenantPrismaClient): Promise<void> {
    const acao = await tenantPrisma.acaoAdministrativa.findUnique({ where: { id: acaoId } });
    if (!acao) throw new NotFoundException('Ação administrativa não encontrada.');
    await tenantPrisma.acaoAdministrativa.delete({ where: { id: acaoId } });
  }
}
