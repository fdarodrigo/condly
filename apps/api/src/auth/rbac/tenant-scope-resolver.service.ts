import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantScope } from '../../prisma/tenant-prisma';

/**
 * Resolve, a partir dos parâmetros de rota, a cadeia completa de escopo
 * (administradoraId → condominioId → unidadeId) do recurso acessado. Usa o
 * PrismaService "cru" (sem filtro de tenant) porque é exatamente aqui que
 * descobrimos a qual tenant o recurso pertence — antes disso não há escopo
 * pra filtrar.
 */
@Injectable()
export class TenantScopeResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(params: Record<string, string>): Promise<TenantScope> {
    if (params.chamadoId) {
      const chamado = await this.prisma.chamado.findUnique({
        where: { id: params.chamadoId },
        include: { condominio: true },
      });
      if (!chamado) {
        throw new NotFoundException('Chamado não encontrado.');
      }
      return {
        administradoraId: chamado.condominio.administradoraId,
        condominioId: chamado.condominioId,
      };
    }

    if (params.unidadeId) {
      const unidade = await this.prisma.unidade.findUnique({
        where: { id: params.unidadeId },
        include: { condominio: true },
      });
      if (!unidade) {
        throw new NotFoundException('Unidade não encontrada.');
      }
      return {
        administradoraId: unidade.condominio.administradoraId,
        condominioId: unidade.condominioId,
        unidadeId: unidade.id,
      };
    }

    if (params.areaComumId) {
      const areaComum = await this.prisma.areaComum.findUnique({
        where: { id: params.areaComumId },
        include: { condominio: true },
      });
      if (!areaComum) {
        throw new NotFoundException('Área comum não encontrada.');
      }
      return {
        administradoraId: areaComum.condominio.administradoraId,
        condominioId: areaComum.condominioId,
      };
    }

    if (params.reservaId) {
      const reserva = await this.prisma.reserva.findUnique({
        where: { id: params.reservaId },
        include: { unidade: { include: { condominio: true } } },
      });
      if (!reserva) {
        throw new NotFoundException('Reserva não encontrada.');
      }
      return {
        administradoraId: reserva.unidade.condominio.administradoraId,
        condominioId: reserva.unidade.condominioId,
        unidadeId: reserva.unidadeId,
      };
    }

    if (params.documentoId) {
      const documento = await this.prisma.documento.findUnique({
        where: { id: params.documentoId },
        include: { condominio: true },
      });
      if (!documento) {
        throw new NotFoundException('Documento não encontrado.');
      }
      return {
        administradoraId: documento.condominio.administradoraId,
        condominioId: documento.condominioId,
      };
    }

    if (params.enqueteId) {
      const enquete = await this.prisma.enquete.findUnique({
        where: { id: params.enqueteId },
        include: { condominio: true },
      });
      if (!enquete) {
        throw new NotFoundException('Enquete não encontrada.');
      }
      return {
        administradoraId: enquete.condominio.administradoraId,
        condominioId: enquete.condominioId,
      };
    }

    if (params.acaoId) {
      const acao = await this.prisma.acaoAdministrativa.findUnique({
        where: { id: params.acaoId },
        include: { condominio: true },
      });
      if (!acao) {
        throw new NotFoundException('Ação administrativa não encontrada.');
      }
      return {
        administradoraId: acao.condominio.administradoraId,
        condominioId: acao.condominioId,
      };
    }

    if (params.avisoId) {
      const aviso = await this.prisma.aviso.findUnique({
        where: { id: params.avisoId },
        include: { condominio: true },
      });
      if (!aviso) {
        throw new NotFoundException('Aviso não encontrado.');
      }
      return {
        administradoraId: aviso.condominio.administradoraId,
        condominioId: aviso.condominioId,
      };
    }

    if (params.assembleiaId) {
      const assembleia = await this.prisma.assembleia.findUnique({
        where: { id: params.assembleiaId },
        include: { condominio: true },
      });
      if (!assembleia) {
        throw new NotFoundException('Assembleia não encontrada.');
      }
      return {
        administradoraId: assembleia.condominio.administradoraId,
        condominioId: assembleia.condominioId,
      };
    }

    if (params.advertenciaId) {
      const advertencia = await this.prisma.advertencia.findUnique({
        where: { id: params.advertenciaId },
        include: { condominio: true },
      });
      if (!advertencia) {
        throw new NotFoundException('Advertência não encontrada.');
      }
      return {
        administradoraId: advertencia.condominio.administradoraId,
        condominioId: advertencia.condominioId,
      };
    }

    if (params.condominioId) {
      const condominio = await this.prisma.condominio.findUnique({
        where: { id: params.condominioId },
      });
      if (!condominio) {
        throw new NotFoundException('Condomínio não encontrado.');
      }
      return {
        administradoraId: condominio.administradoraId,
        condominioId: condominio.id,
      };
    }

    if (params.administradoraId) {
      const administradora = await this.prisma.administradora.findUnique({
        where: { id: params.administradoraId },
      });
      if (!administradora) {
        throw new NotFoundException('Administradora não encontrada.');
      }
      return { administradoraId: administradora.id };
    }

    throw new Error(
      'Rota protegida por @Roles precisa declarar administradoraId, condominioId ou unidadeId nos parâmetros.',
    );
  }
}
