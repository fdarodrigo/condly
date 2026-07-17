import { Module } from '@nestjs/common';
import { AvisosController } from './avisos.controller';
import { AvisosService } from './avisos.service';
import { EMAIL_CLIENT } from './email/email-client.interface';
import { ResendEmailClient } from './email/resend-email-client';
import { WHATSAPP_CLIENT } from './whatsapp/whatsapp-client.interface';
import { WhatsappCloudApiAvisoClient } from './whatsapp/whatsapp-cloud-api-aviso-client';
import { AuthModule } from '../auth/auth.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { CondominiosModule } from '../condominios/condominios.module';

@Module({
  imports: [AuthModule, WhatsappModule, CondominiosModule],
  controllers: [AvisosController],
  providers: [
    AvisosService,
    { provide: EMAIL_CLIENT, useClass: ResendEmailClient },
    { provide: WHATSAPP_CLIENT, useClass: WhatsappCloudApiAvisoClient },
  ],
  exports: [AvisosService],
})
export class AvisosModule {}
