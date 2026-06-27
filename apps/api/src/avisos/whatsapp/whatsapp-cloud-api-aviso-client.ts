import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Aviso } from '../../../generated/prisma/client';
import {
  WHATSAPP_CLOUD_API_CLIENT,
  WhatsappCloudApiClient,
} from '../../whatsapp/whatsapp-cloud-api-client.interface';
import { resolverDestinatariosDoAviso } from '../resolver-destinatarios-aviso';
import { WhatsappClient } from './whatsapp-client.interface';

/**
 * Implementação real do canal WHATSAPP de Aviso (Prompt 9) — substitui o
 * stub do Prompt 7. Roda fora do ciclo de request/response (chamado de
 * dentro de `AvisosService.dispararEnvio`), então usa o `PrismaService`
 * cru: não há `tenantPrisma` escopado por Guard aqui, só o
 * `aviso.condominioId`/`aviso.unidadeId` já validados na criação do Aviso.
 */
@Injectable()
export class WhatsappCloudApiAvisoClient implements WhatsappClient {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WHATSAPP_CLOUD_API_CLIENT) private readonly cloudApiClient: WhatsappCloudApiClient,
  ) {}

  async enviarAvisoWhatsapp(aviso: Aviso): Promise<void> {
    const destinatarios = await resolverDestinatariosDoAviso(aviso, this.prisma);

    for (const usuario of destinatarios) {
      if (usuario.telefoneWhatsapp) {
        await this.cloudApiClient.enviarMensagemTexto(
          usuario.telefoneWhatsapp,
          `*${aviso.titulo}*\n\n${aviso.corpo}`,
        );
      }
    }
  }
}
