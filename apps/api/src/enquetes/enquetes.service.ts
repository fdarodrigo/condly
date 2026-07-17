import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { AvisosService } from '../avisos/avisos.service';
import { CriarEnqueteDto } from './dto/criar-enquete.dto';
import { AtualizarEnqueteDto } from './dto/atualizar-enquete.dto';
import { VotarDto } from './dto/votar.dto';

@Injectable()
export class EnquetesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avisosService: AvisosService,
  ) {}

  async listar(tenantPrisma: TenantPrismaClient, usuarioId: string) {
    const enquetes = await tenantPrisma.enquete.findMany({
      include: { opcoes: { orderBy: { ordem: 'asc' } } },
      orderBy: { criadoEm: 'desc' },
    });

    if (enquetes.length === 0) return [];

    const votos = await this.prisma.votoEnquete.findMany({
      where: { enqueteId: { in: enquetes.map((e) => e.id) } },
      select: {
        enqueteId: true,
        opcaoId: true,
        usuarioId: true,
        usuario: { select: { nome: true } },
      },
    });

    return enquetes.map((e) => this.enriquecerEnquete(e, votos, usuarioId));
  }

  async criar(condominioId: string, dto: CriarEnqueteDto, tenantPrisma: TenantPrismaClient) {
    const enquete = await tenantPrisma.enquete.create({
      data: {
        condominioId,
        titulo: dto.titulo,
        descricao: dto.descricao,
        tipo: dto.tipo,
        anonima: dto.anonima ?? false,
        inicioEm: new Date(dto.inicioEm),
        fimEm: new Date(dto.fimEm),
        opcoes: {
          create: dto.opcoes.map((op, i) => ({ texto: op.texto, ordem: i + 1 })),
        },
      },
      include: { opcoes: { orderBy: { ordem: 'asc' } } },
    });

    if (dto.gerarAviso) {
      const tipoLabel = dto.tipo === 'GESTAO' ? 'Gestão' : 'Serviços';
      await this.avisosService.criar(
        condominioId,
        {
          titulo: `Enquete: ${dto.titulo}`,
          corpo: `Nova enquete de satisfação com ${tipoLabel} disponível. Acesse o app e vote!`,
          canais: ['APP'],
          unidadeId: undefined,
        },
        tenantPrisma,
      );
    }

    return { ...enquete, totalVotos: 0, meuVotoOpcaoId: null };
  }

  async atualizar(enqueteId: string, dto: AtualizarEnqueteDto, tenantPrisma: TenantPrismaClient) {
    const enquete = await tenantPrisma.enquete.findUnique({ where: { id: enqueteId } });
    if (!enquete) throw new NotFoundException('Enquete não encontrada.');
    if (enquete.status !== 'RASCUNHO') {
      throw new BadRequestException('Só é possível editar enquetes em rascunho.');
    }
    return tenantPrisma.enquete.update({
      where: { id: enqueteId },
      data: {
        ...(dto.titulo !== undefined && { titulo: dto.titulo }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.inicioEm !== undefined && { inicioEm: new Date(dto.inicioEm) }),
        ...(dto.fimEm !== undefined && { fimEm: new Date(dto.fimEm) }),
      },
      include: { opcoes: { orderBy: { ordem: 'asc' } } },
    });
  }

  async publicar(enqueteId: string, tenantPrisma: TenantPrismaClient) {
    const enquete = await tenantPrisma.enquete.findUnique({ where: { id: enqueteId } });
    if (!enquete) throw new NotFoundException('Enquete não encontrada.');
    if (enquete.status !== 'RASCUNHO') {
      throw new BadRequestException('Só rascunhos podem ser publicados.');
    }
    return tenantPrisma.enquete.update({
      where: { id: enqueteId },
      data: { status: 'ATIVA' },
    });
  }

  async encerrar(enqueteId: string, tenantPrisma: TenantPrismaClient) {
    const enquete = await tenantPrisma.enquete.findUnique({ where: { id: enqueteId } });
    if (!enquete) throw new NotFoundException('Enquete não encontrada.');
    if (enquete.status !== 'ATIVA') {
      throw new BadRequestException('Só enquetes ativas podem ser encerradas.');
    }
    return tenantPrisma.enquete.update({
      where: { id: enqueteId },
      data: { status: 'ENCERRADA' },
    });
  }

  async remover(enqueteId: string, tenantPrisma: TenantPrismaClient): Promise<void> {
    const enquete = await tenantPrisma.enquete.findUnique({ where: { id: enqueteId } });
    if (!enquete) throw new NotFoundException('Enquete não encontrada.');
    if (enquete.status !== 'RASCUNHO') {
      throw new BadRequestException('Só rascunhos podem ser excluídos.');
    }
    // OpcaoEnquete sem cascade — deleta na ordem certa
    await this.prisma.$transaction([
      this.prisma.votoEnquete.deleteMany({ where: { enqueteId } }),
      this.prisma.opcaoEnquete.deleteMany({ where: { enqueteId } }),
      this.prisma.enquete.delete({ where: { id: enqueteId } }),
    ]);
  }

  async votar(
    enqueteId: string,
    dto: VotarDto,
    tenantPrisma: TenantPrismaClient,
    usuarioId: string,
  ) {
    const enquete = await tenantPrisma.enquete.findUnique({ where: { id: enqueteId } });
    if (!enquete) throw new NotFoundException('Enquete não encontrada.');
    if (enquete.status !== 'ATIVA') {
      throw new BadRequestException('Não é possível votar em enquetes que não estejam ativas.');
    }

    // Valida que a opção pertence a esta enquete
    const opcao = await this.prisma.opcaoEnquete.findFirst({
      where: { id: dto.opcaoId, enqueteId },
    });
    if (!opcao) throw new BadRequestException('Opção inválida para esta enquete.');

    await this.prisma.votoEnquete.upsert({
      where: { enqueteId_usuarioId: { enqueteId, usuarioId } },
      create: { enqueteId, opcaoId: dto.opcaoId, usuarioId },
      update: { opcaoId: dto.opcaoId },
    });

    return { sucesso: true };
  }

  private enriquecerEnquete(
    enquete: {
      id: string;
      anonima: boolean;
      opcoes: { id: string; texto: string; ordem: number }[];
    } & Record<string, unknown>,
    votos: { enqueteId: string; opcaoId: string; usuarioId: string; usuario: { nome: string } }[],
    usuarioId: string,
  ) {
    const votosDaEnquete = votos.filter((v) => v.enqueteId === enquete.id);
    const meuVoto = votosDaEnquete.find((v) => v.usuarioId === usuarioId);
    return {
      ...enquete,
      totalVotos: votosDaEnquete.length,
      meuVotoOpcaoId: meuVoto?.opcaoId ?? null,
      opcoes: enquete.opcoes.map((op) => {
        const votosOpcao = votosDaEnquete.filter((v) => v.opcaoId === op.id);
        return {
          ...op,
          totalVotos: votosOpcao.length,
          votantes: enquete.anonima ? undefined : votosOpcao.map((v) => ({ nome: v.usuario.nome })),
        };
      }),
    };
  }
}
