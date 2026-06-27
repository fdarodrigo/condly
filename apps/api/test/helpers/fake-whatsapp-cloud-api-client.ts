import { WhatsappCloudApiClient } from '../../src/whatsapp/whatsapp-cloud-api-client.interface';

/**
 * Substitui o WhatsappCloudApiHttpClient real nos testes de integração —
 * nenhum teste deve depender de rede ou de credenciais reais da Meta.
 */
export class FakeWhatsappCloudApiClient implements WhatsappCloudApiClient {
  public chamadas: { telefoneWhatsapp: string; texto: string }[] = [];

  async enviarMensagemTexto(telefoneWhatsapp: string, texto: string): Promise<void> {
    this.chamadas.push({ telefoneWhatsapp, texto });
  }
}
