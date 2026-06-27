import { Aviso } from '../../generated/prisma/client';
import { WhatsappClient } from '../../src/avisos/whatsapp/whatsapp-client.interface';

/**
 * Substitui o WhatsappCloudApiAvisoClient real nos testes de integração —
 * nenhum teste deste módulo deve depender de rede ou de credenciais reais
 * da Meta.
 */
export class FakeWhatsappClient implements WhatsappClient {
  public chamadas: Aviso[] = [];

  async enviarAvisoWhatsapp(aviso: Aviso): Promise<void> {
    this.chamadas.push(aviso);
  }
}
