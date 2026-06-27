import { Injectable } from '@nestjs/common';
import { WhatsappCloudApiClient } from './whatsapp-cloud-api-client.interface';

/**
 * Implementação real (via HTTP) do envio de mensagem pela Meta WhatsApp
 * Cloud API. Em testes esse provider é substituído por um fake via
 * `overrideProvider(WHATSAPP_CLOUD_API_CLIENT)` — nenhum teste depende de
 * rede ou de credenciais reais da Meta.
 */
@Injectable()
export class WhatsappCloudApiHttpClient implements WhatsappCloudApiClient {
  private get baseUrl(): string {
    const versao = process.env.WHATSAPP_API_VERSION ?? 'v21.0';
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
    return `https://graph.facebook.com/${versao}/${phoneNumberId}/messages`;
  }

  async enviarMensagemTexto(telefoneWhatsapp: string, texto: string): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_API_TOKEN ?? ''}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: telefoneWhatsapp,
        type: 'text',
        text: { body: texto },
      }),
    });

    if (!response.ok) {
      throw new Error(`Falha ao enviar mensagem via WhatsApp Cloud API (HTTP ${response.status}).`);
    }
  }
}
