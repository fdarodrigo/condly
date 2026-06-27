import { Aviso } from '../../../generated/prisma/client';

export const WHATSAPP_CLIENT = 'WHATSAPP_CLIENT';

export interface WhatsappClient {
  enviarAvisoWhatsapp(aviso: Aviso): Promise<void>;
}
