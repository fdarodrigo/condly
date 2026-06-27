import { Aviso } from '../../generated/prisma/client';
import { WhatsappClient } from '../../src/avisos/whatsapp/whatsapp-client.interface';

/**
 * Substitui o WhatsappStubClient nos testes de integração — registra as
 * chamadas para que o teste possa verificar que o canal WHATSAPP de fato
 * aciona a função stub, sem lançar erro, mesmo sem implementação real.
 */
export class FakeWhatsappClient implements WhatsappClient {
  public chamadas: Aviso[] = [];

  async enviarAvisoWhatsapp(aviso: Aviso): Promise<void> {
    this.chamadas.push(aviso);
  }
}
