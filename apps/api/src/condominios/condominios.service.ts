import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { PermissoesSindicoService } from './permissoes-sindico.service';

export interface AtualizarCondominioDto {
  nome?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  permissoesSindico?: Record<string, boolean>;
}

export interface CriarMembroDto {
  nome?: string;
  email: string;
  senha?: string;
  telefoneWhatsapp?: string;
  papel: 'SINDICO' | 'CONDOMINO';
  unidadeId?: string;
}

@Injectable()
export class CondominiosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissoesService: PermissoesSindicoService,
  ) {}

  async criar(
    administradoraId: string,
    dto: { nome: string; endereco: string; cnpj: string; telefone?: string; email?: string },
  ) {
    const existente = await this.prisma.condominio.findUnique({ where: { cnpj: dto.cnpj } });
    if (existente) throw new ConflictException('CNPJ já cadastrado.');
    return this.prisma.condominio.create({
      data: {
        administradoraId,
        nome: dto.nome,
        endereco: dto.endereco,
        cnpj: dto.cnpj,
        telefone: dto.telefone,
        email: dto.email,
      },
    });
  }

  async atualizar(
    condominioId: string,
    dto: AtualizarCondominioDto,
    usuario: AuthenticatedUser,
    tenantPrisma: TenantPrismaClient,
  ) {
    const cond = await tenantPrisma.condominio.findUnique({ where: { id: condominioId } });
    if (!cond) throw new NotFoundException('Condomínio não encontrado.');

    // permissoesSindico só pode ser alterada por um vínculo ADMINISTRADORA da
    // administradora DESTE condomínio — checagem contra cond.administradoraId
    // (não basta ter algum vínculo ADMINISTRADORA: um síndico deste condomínio
    // que por acaso administra OUTRA carteira não pode se autodesbloquear).
    if (dto.permissoesSindico !== undefined) {
      const ehAdministradoraDoCondominio = usuario.vinculos.some(
        (v) => v.papel === 'ADMINISTRADORA' && v.administradoraId === cond.administradoraId,
      );
      if (!ehAdministradoraDoCondominio) {
        throw new ForbiddenException(
          'Somente a administradora pode alterar as permissões do síndico.',
        );
      }
    }

    return tenantPrisma.condominio.update({
      where: { id: condominioId },
      data: {
        ...(dto.nome !== undefined && { nome: dto.nome }),
        ...(dto.endereco !== undefined && { endereco: dto.endereco }),
        ...(dto.telefone !== undefined && { telefone: dto.telefone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.permissoesSindico !== undefined && {
          permissoesSindico: {
            ...this.permissoesService.obterPermissoes(cond.permissoesSindico),
            ...dto.permissoesSindico,
          },
        }),
      },
    });
  }

  async remover(condominioId: string, tenantPrisma: TenantPrismaClient) {
    const cond = await tenantPrisma.condominio.findUnique({
      where: { id: condominioId },
      include: { vinculos: { take: 1 } },
    });
    if (!cond) throw new NotFoundException('Condomínio não encontrado.');
    if (cond.vinculos.length > 0) {
      throw new BadRequestException(
        'Não é possível excluir um condomínio com usuários vinculados.',
      );
    }
    await this.prisma.condominio.delete({ where: { id: condominioId } });
  }

  async listarMembros(condominioId: string, tenantPrisma: TenantPrismaClient) {
    // Vínculo de CONDOMINO pode carregar só unidadeId (é assim que o seed e o
    // login os tratam) — filtrar só por vinculo.condominioId deixava todos
    // esses condôminos fora da lista de membros. O OR cobre os dois formatos,
    // sempre pinado ao mesmo condominioId.
    const vinculos = await tenantPrisma.vinculoUsuario.findMany({
      where: { OR: [{ condominioId }, { unidade: { condominioId } }] },
      include: { usuario: true, unidade: true },
      orderBy: [{ papel: 'asc' }, { usuario: { nome: 'asc' } }],
    });
    return vinculos.map((v) => ({
      vinculoId: v.id,
      usuarioId: v.usuarioId,
      nome: v.usuario.nome,
      email: v.usuario.email,
      telefoneWhatsapp: v.usuario.telefoneWhatsapp,
      papel: v.papel,
      unidade: v.unidade ? { id: v.unidade.id, identificador: v.unidade.identificador } : null,
    }));
  }

  async adicionarMembro(
    condominioId: string,
    dto: CriarMembroDto,
    tenantPrisma: TenantPrismaClient,
  ) {
    // A administradoraId do vínculo criado vem do próprio Condominio (já
    // validado pelo tenantPrisma), nunca do vínculo de quem chama — permite
    // que um SINDICO (que não tem administradoraId) adicione membros sem
    // gravar vínculo órfão, e nunca grava a administradora "errada".
    const cond = await tenantPrisma.condominio.findUnique({ where: { id: condominioId } });
    if (!cond) throw new NotFoundException('Condomínio não encontrado.');

    if (dto.papel === 'CONDOMINO' && !dto.unidadeId) {
      throw new BadRequestException('Condômino precisa de uma unidade associada.');
    }

    if (dto.papel === 'CONDOMINO' && dto.unidadeId) {
      const unidade = await tenantPrisma.unidade.findUnique({ where: { id: dto.unidadeId } });
      if (!unidade || unidade.condominioId !== condominioId) {
        throw new BadRequestException('Unidade não pertence a este condomínio.');
      }
    }

    let usuario = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (!usuario) {
      if (!dto.nome || !dto.senha) {
        throw new BadRequestException(
          'Nome e senha são obrigatórios para cadastrar um novo usuário.',
        );
      }
      const senhaHash = await bcrypt.hash(dto.senha, 10);
      usuario = await this.prisma.usuario.create({
        data: {
          nome: dto.nome,
          email: dto.email,
          senhaHash,
          telefoneWhatsapp: dto.telefoneWhatsapp,
        },
      });
    }

    const vinculoExistente = await this.prisma.vinculoUsuario.findFirst({
      where: { usuarioId: usuario.id, condominioId },
    });
    if (vinculoExistente) {
      throw new ConflictException('Usuário já possui vínculo neste condomínio.');
    }

    await this.prisma.vinculoUsuario.create({
      data: {
        usuarioId: usuario.id,
        papel: dto.papel,
        condominioId,
        administradoraId: cond.administradoraId,
        unidadeId: dto.papel === 'CONDOMINO' ? (dto.unidadeId ?? null) : null,
      },
    });

    return { usuarioId: usuario.id, nome: usuario.nome, email: usuario.email, papel: dto.papel };
  }

  async removerMembro(condominioId: string, usuarioId: string, tenantPrisma: TenantPrismaClient) {
    const vinculo = await tenantPrisma.vinculoUsuario.findFirst({
      where: { condominioId, usuarioId },
    });
    if (!vinculo) throw new NotFoundException('Vínculo não encontrado.');
    await this.prisma.vinculoUsuario.delete({ where: { id: vinculo.id } });
  }
}
