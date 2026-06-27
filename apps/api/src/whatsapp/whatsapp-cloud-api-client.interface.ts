export const WHATSAPP_CLOUD_API_CLIENT = 'WHATSAPP_CLOUD_API_CLIENT';

/**
 * Client "cru" de envio de mensagem de texto via Meta WhatsApp Cloud API —
 * compartilhado entre o canal WHATSAPP de Aviso (`avisos/whatsapp/`) e as
 * respostas do bot (`bot/`). Não sabe nada de Aviso/ConversaBot/intenção;
 * só envia texto pro número informado.
 */
export interface WhatsappCloudApiClient {
  enviarMensagemTexto(telefoneWhatsapp: string, texto: string): Promise<void>;
}
