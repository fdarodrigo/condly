import { Injectable } from '@nestjs/common';
import { Aviso } from '../../../generated/prisma/client';
import { WhatsappClient } from './whatsapp-client.interface';

/**
 * Stub deliberado — a implementação real (Meta WhatsApp Cloud API) entra no
 * Prompt 9. Não resolve destinatários nem envia nada, só não pode lançar
 * erro: o canal WHATSAPP precisa poder ser selecionado num Aviso hoje sem
 * quebrar a criação, mesmo sem o canal de fato funcionar ainda.
 */
@Injectable()
export class WhatsappStubClient implements WhatsappClient {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura de WhatsappClient; o stub não usa o aviso ainda.
  async enviarAvisoWhatsapp(aviso: Aviso): Promise<void> {
    return;
  }
}
