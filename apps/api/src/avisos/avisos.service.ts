import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { Aviso } from '../../generated/prisma/client';
import { CriarAvisoDto } from './dto/criar-aviso.dto';
import { AtualizarAvisoDto } from './dto/atualizar-aviso.dto';
import { EMAIL_CLIENT, EmailClient } from './email/email-client.interface';
import { WHATSAPP_CLIENT, WhatsappClient } from './whatsapp/whatsapp-client.interface';
import { resolverDestinatariosDoAviso } from './resolver-destinatarios-aviso';

@Injectable()
export class AvisosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_CLIENT) private readonly emailClient: EmailClient,
    @Inject(WHATSAPP_CLIENT) private readonly whatsappClient: WhatsappClient,
  ) {}

  async criar(condominioId: string, dto: CriarAvisoDto, tenantPrisma: TenantPrismaClient) {
    if (dto.unidadeId) {
      const unidade = await tenantPrisma.unidade.findUnique({ where: { id: dto.unidadeId } });
      if (!unidade || unidade.condominioId !== condominioId) {
        throw new NotFoundException('Unidade não encontrada neste condomínio.');
      }
    }

    const aviso = await tenantPrisma.aviso.create({
      data: {
        condominioId,
        unidadeId: dto.unidadeId,
        titulo: dto.titulo,
        corpo: dto.corpo,
        canais: dto.canais,
        enviadoEm: new Date(),
      },
    });

    await this.dispararEnvio(aviso, tenantPrisma);

    return aviso;
  }

  async listarNaoLidos(usuarioId: string) {
    const leituras = await this.prisma.avisoLeitura.findMany({
      where: { usuarioId, lidoEm: null },
      include: { aviso: true },
      orderBy: { aviso: { enviadoEm: 'desc' } },
    });

    return leituras.map((leitura) => leitura.aviso);
  }

  /**
   * Busca pela chave composta `[avisoId, usuarioId]` (igual ao
   * `@@unique` do model) — não existe linha de AvisoLeitura pra um par
   * que não seja "este usuário é destinatário deste aviso", então o
   * mesmo 404 cobre aviso inexistente, aviso de outro usuário e aviso de
   * outro tenant sem precisar de nenhum branch novo em
   * tenant-scope-resolver.service.ts (mesmo espírito do "me" pattern já
   * usado em listarNaoLidos: o filtro de tenant aqui é a própria
   * igualdade usuarioId = usuário logado).
   */
  async marcarComoLido(avisoId: string, usuarioId: string): Promise<void> {
    const leitura = await this.prisma.avisoLeitura.findUnique({
      where: { avisoId_usuarioId: { avisoId, usuarioId } },
    });
    if (!leitura) {
      throw new NotFoundException('Aviso não encontrado.');
    }

    await this.prisma.avisoLeitura.update({
      where: { id: leitura.id },
      data: { lidoEm: new Date() },
    });
  }

  async listar(tenantPrisma: TenantPrismaClient) {
    return tenantPrisma.aviso.findMany({
      orderBy: { enviadoEm: 'desc' },
    });
  }

  async atualizar(avisoId: string, dto: AtualizarAvisoDto, tenantPrisma: TenantPrismaClient) {
    const aviso = await tenantPrisma.aviso.findUnique({ where: { id: avisoId } });
    if (!aviso) throw new NotFoundException('Aviso não encontrado.');
    return tenantPrisma.aviso.update({
      where: { id: avisoId },
      data: {
        ...(dto.titulo !== undefined && { titulo: dto.titulo }),
        ...(dto.corpo !== undefined && { corpo: dto.corpo }),
      },
    });
  }

  async remover(avisoId: string, tenantPrisma: TenantPrismaClient): Promise<void> {
    const aviso = await tenantPrisma.aviso.findUnique({ where: { id: avisoId } });
    if (!aviso) throw new NotFoundException('Aviso não encontrado.');
    // AvisoLeitura não tem onDelete cascade — deleta antes em transação
    await this.prisma.$transaction([
      this.prisma.avisoLeitura.deleteMany({ where: { avisoId } }),
      this.prisma.aviso.delete({ where: { id: avisoId } }),
    ]);
  }

  private async dispararEnvio(aviso: Aviso, tenantPrisma: TenantPrismaClient): Promise<void> {
    const destinatarios = await resolverDestinatariosDoAviso(aviso, tenantPrisma);

    if (aviso.canais.includes('APP')) {
      await tenantPrisma.avisoLeitura.createMany({
        data: destinatarios.map((usuario) => ({ avisoId: aviso.id, usuarioId: usuario.id })),
        skipDuplicates: true,
      });
    }

    if (aviso.canais.includes('EMAIL')) {
      const condominio = await tenantPrisma.condominio.findUnique({
        where: { id: aviso.condominioId },
        include: { administradora: true },
      });
      const remetenteNome = condominio?.administradora.nome ?? 'Condly';

      for (const usuario of destinatarios) {
        await this.emailClient.enviar({
          remetenteNome,
          destinatarioEmail: usuario.email,
          assunto: aviso.titulo,
          corpo: aviso.corpo,
        });
      }
    }

    if (aviso.canais.includes('WHATSAPP')) {
      await this.whatsappClient.enviarAvisoWhatsapp(aviso);
    }
  }
}
