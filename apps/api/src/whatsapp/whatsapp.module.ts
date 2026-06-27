import { Module } from '@nestjs/common';
import { WHATSAPP_CLOUD_API_CLIENT } from './whatsapp-cloud-api-client.interface';
import { WhatsappCloudApiHttpClient } from './whatsapp-cloud-api-http-client';

@Module({
  providers: [{ provide: WHATSAPP_CLOUD_API_CLIENT, useClass: WhatsappCloudApiHttpClient }],
  exports: [WHATSAPP_CLOUD_API_CLIENT],
})
export class WhatsappModule {}
