import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { CriarUnidadeDto } from './dto/criar-unidade.dto';
import { AtualizarUnidadeDto } from './dto/atualizar-unidade.dto';

@Injectable()
export class UnidadesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Rota "minha conta" (sem condominioId/unidadeId no path) — o filtro de
   * tenant aqui é a própria igualdade `usuarioId = usuário logado`, mesmo
   * padrão já usado em `AvisosService.listarNaoLidos`. A unidade nunca vem
   * de um parâmetro informado pelo cliente: é resolvida só a partir do
   * vínculo do usuário autenticado, igual a `BotService.resolverIdentidade`
   * (mesma regra de identidade, só que a "identidade" aqui já vem do JWT em
   * vez do telefoneWhatsapp).
   */
  async meuSaldo(usuarioId: string) {
    const vinculo = await this.prisma.vinculoUsuario.findFirst({
      where: { usuarioId, unidadeId: { not: null } },
    });
    if (!vinculo?.unidadeId) {
      throw new NotFoundException('Usuário não está vinculado a nenhuma unidade.');
    }

    const cobrancaPendente = await this.prisma.cobranca.findFirst({
      where: { unidadeId: vinculo.unidadeId, status: { in: ['PENDENTE', 'ATRASADO'] } },
      orderBy: { vencimento: 'desc' },
    });

    return { unidadeId: vinculo.unidadeId, cobrancaPendente };
  }

  async listar(condominioId: string, tenantPrisma: TenantPrismaClient) {
    return tenantPrisma.unidade.findMany({
      where: { condominioId },
      orderBy: { identificador: 'asc' },
    });
  }

  async criar(condominioId: string, dto: CriarUnidadeDto, tenantPrisma: TenantPrismaClient) {
    const existente = await tenantPrisma.unidade.findFirst({
      where: { condominioId, identificador: dto.identificador },
    });
    if (existente) throw new ConflictException('Identificador já existe neste condomínio.');
    return tenantPrisma.unidade.create({
      data: {
        condominioId,
        identificador: dto.identificador,
        tipo: dto.tipo,
        responsavelNome: dto.responsavelNome,
        responsavelEmail: dto.responsavelEmail,
        responsavelCpfCnpj: dto.responsavelCpfCnpj,
      },
    });
  }

  async atualizar(unidadeId: string, dto: AtualizarUnidadeDto, tenantPrisma: TenantPrismaClient) {
    const unidade = await tenantPrisma.unidade.findUnique({ where: { id: unidadeId } });
    if (!unidade) throw new NotFoundException('Unidade não encontrada.');
    return tenantPrisma.unidade.update({
      where: { id: unidadeId },
      data: {
        ...(dto.identificador !== undefined && { identificador: dto.identificador }),
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.responsavelNome !== undefined && { responsavelNome: dto.responsavelNome }),
        ...(dto.responsavelEmail !== undefined && { responsavelEmail: dto.responsavelEmail }),
        ...(dto.responsavelCpfCnpj !== undefined && { responsavelCpfCnpj: dto.responsavelCpfCnpj }),
      },
    });
  }

  async remover(unidadeId: string, tenantPrisma: TenantPrismaClient) {
    const unidade = await tenantPrisma.unidade.findUnique({
      where: { id: unidadeId },
      include: { vinculos: { take: 1 } },
    });
    if (!unidade) throw new NotFoundException('Unidade não encontrada.');
    if (unidade.vinculos.length > 0) {
      throw new BadRequestException('Não é possível excluir uma unidade com usuários vinculados.');
    }
    await this.prisma.unidade.delete({ where: { id: unidadeId } });
  }
}
