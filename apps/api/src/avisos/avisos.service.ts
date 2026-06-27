import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { Aviso } from '../../generated/prisma/client';
import { CriarAvisoDto } from './dto/criar-aviso.dto';
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
