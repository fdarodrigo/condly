import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { CriarAdvertenciaDto } from './dto/criar-advertencia.dto';

@Injectable()
export class AdvertenciasService {
  async criar(
    condominioId: string,
    dto: CriarAdvertenciaDto,
    usuario: AuthenticatedUser,
    tenantPrisma: TenantPrismaClient,
  ) {
    const unidade = await tenantPrisma.unidade.findUnique({ where: { id: dto.unidadeId } });
    if (!unidade || unidade.condominioId !== condominioId) {
      throw new NotFoundException('Unidade não encontrada neste condomínio.');
    }

    return tenantPrisma.advertencia.create({
      data: {
        condominioId,
        unidadeId: dto.unidadeId,
        remetenteId: usuario.usuarioId,
        motivo: dto.motivo,
        descricao: dto.descricao,
      },
      include: {
        unidade: { select: { identificador: true } },
        remetente: { select: { nome: true } },
      },
    });
  }

  async listar(condominioId: string, tenantPrisma: TenantPrismaClient) {
    return tenantPrisma.advertencia.findMany({
      where: { condominioId },
      include: {
        unidade: { select: { identificador: true } },
        remetente: { select: { nome: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  // Rota "minha conta": filtra por unidade(s) do próprio condômino, sem
  // tenantPrisma — mesmo padrão de GET /usuarios/me/avisos.
  async listarMinhas(usuario: AuthenticatedUser, prisma: TenantPrismaClient) {
    const unidadeIds = usuario.vinculos
      .filter((v) => v.papel === 'CONDOMINO' && v.unidadeId)
      .map((v) => v.unidadeId!);

    if (unidadeIds.length === 0) return [];

    return prisma.advertencia.findMany({
      where: { unidadeId: { in: unidadeIds } },
      include: {
        unidade: { select: { identificador: true } },
        condominio: { select: { nome: true } },
        remetente: { select: { nome: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async remover(advertenciaId: string, tenantPrisma: TenantPrismaClient) {
    const advertencia = await tenantPrisma.advertencia.findUnique({
      where: { id: advertenciaId },
    });
    if (!advertencia) throw new NotFoundException('Advertência não encontrada.');
    await tenantPrisma.advertencia.delete({ where: { id: advertenciaId } });
  }
}
