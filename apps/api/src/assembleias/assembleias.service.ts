import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { CriarAssembleiaDto } from './dto/criar-assembleia.dto';
import { AtualizarAssembleiaDto } from './dto/atualizar-assembleia.dto';
import { AdicionarDocumentoDto } from './dto/adicionar-documento.dto';

const INCLUDE_COMPLETO = {
  pautas: { orderBy: { ordem: 'asc' as const } },
  documentos: true,
};

@Injectable()
export class AssembleiasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(condominioId: string, tenantPrisma: TenantPrismaClient) {
    return tenantPrisma.assembleia.findMany({
      where: { condominioId },
      include: INCLUDE_COMPLETO,
      orderBy: { dataHora: 'desc' },
    });
  }

  async criar(condominioId: string, dto: CriarAssembleiaDto, tenantPrisma: TenantPrismaClient) {
    return tenantPrisma.assembleia.create({
      data: {
        condominioId,
        titulo: dto.titulo,
        tipo: dto.tipo,
        dataHora: new Date(dto.dataHora),
        local: dto.local,
        pautas: {
          create: dto.pautas.map((p, i) => ({
            titulo: p.titulo,
            descricao: p.descricao,
            ordem: i + 1,
          })),
        },
      },
      include: INCLUDE_COMPLETO,
    });
  }

  async atualizar(
    assembleiaId: string,
    dto: AtualizarAssembleiaDto,
    tenantPrisma: TenantPrismaClient,
  ) {
    const assembleia = await tenantPrisma.assembleia.findUnique({
      where: { id: assembleiaId },
    });
    if (!assembleia) throw new NotFoundException('Assembleia não encontrada.');
    if (assembleia.status === 'CANCELADA') {
      throw new BadRequestException('Assembleia cancelada não pode ser editada.');
    }

    await tenantPrisma.assembleia.update({
      where: { id: assembleiaId },
      data: {
        ...(dto.titulo !== undefined && { titulo: dto.titulo }),
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.dataHora !== undefined && { dataHora: new Date(dto.dataHora) }),
        ...(dto.local !== undefined && { local: dto.local }),
        ...(dto.linkGravacao !== undefined && { linkGravacao: dto.linkGravacao }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.acrescimoTaxa !== undefined && { acrescimoTaxa: dto.acrescimoTaxa }),
        ...(dto.acrescimoAte !== undefined && { acrescimoAte: new Date(dto.acrescimoAte) }),
      },
      include: INCLUDE_COMPLETO,
    });

    // Atualiza deliberações de pautas individuais — usa prisma cru com
    // filtro duplo (id + assembleiaId) para garantir que só pautas desta
    // assembleia são modificadas, mesmo sem condominioId próprio no model.
    if (dto.pautas?.length) {
      await Promise.all(
        dto.pautas.map((p) =>
          this.prisma.pautaAssembleia.updateMany({
            where: { id: p.id, assembleiaId },
            data: { deliberacao: p.deliberacao ?? null },
          }),
        ),
      );
    }

    return tenantPrisma.assembleia.findUnique({
      where: { id: assembleiaId },
      include: INCLUDE_COMPLETO,
    });
  }

  async remover(assembleiaId: string, tenantPrisma: TenantPrismaClient) {
    const assembleia = await tenantPrisma.assembleia.findUnique({
      where: { id: assembleiaId },
    });
    if (!assembleia) throw new NotFoundException('Assembleia não encontrada.');
    if (assembleia.status !== 'AGENDADA') {
      throw new BadRequestException('Só é possível excluir assembleias com status AGENDADA.');
    }

    // PautaAssembleia e AssembleiaDocumento não têm onDelete: Cascade,
    // então é necessário deletar filhos primeiro.
    await this.prisma.$transaction([
      this.prisma.pautaAssembleia.deleteMany({ where: { assembleiaId } }),
      this.prisma.assembleiaDocumento.deleteMany({ where: { assembleiaId } }),
      this.prisma.assembleia.delete({ where: { id: assembleiaId } }),
    ]);
  }

  async adicionarDocumento(
    assembleiaId: string,
    dto: AdicionarDocumentoDto,
    tenantPrisma: TenantPrismaClient,
  ) {
    const assembleia = await tenantPrisma.assembleia.findUnique({
      where: { id: assembleiaId },
    });
    if (!assembleia) throw new NotFoundException('Assembleia não encontrada.');

    return this.prisma.assembleiaDocumento.create({
      data: { assembleiaId, titulo: dto.titulo, url: dto.url },
    });
  }

  async removerDocumento(assembleiaId: string, docId: string, tenantPrisma: TenantPrismaClient) {
    // Valida o pai via tenantPrisma antes de operar no filho com prisma cru.
    const assembleia = await tenantPrisma.assembleia.findUnique({
      where: { id: assembleiaId },
    });
    if (!assembleia) throw new NotFoundException('Assembleia não encontrada.');

    const doc = await this.prisma.assembleiaDocumento.findFirst({
      where: { id: docId, assembleiaId },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado.');

    await this.prisma.assembleiaDocumento.delete({ where: { id: docId } });
  }
}
