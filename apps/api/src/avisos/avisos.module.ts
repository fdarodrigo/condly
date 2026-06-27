import { Module } from '@nestjs/common';
import { AvisosController } from './avisos.controller';
import { AvisosService } from './avisos.service';
import { EMAIL_CLIENT } from './email/email-client.interface';
import { ResendEmailClient } from './email/resend-email-client';
import { WHATSAPP_CLIENT } from './whatsapp/whatsapp-client.interface';
import { WhatsappStubClient } from './whatsapp/whatsapp-stub-client';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AvisosController],
  providers: [
    AvisosService,
    { provide: EMAIL_CLIENT, useClass: ResendEmailClient },
    { provide: WHATSAPP_CLIENT, useClass: WhatsappStubClient },
  ],
})
export class AvisosModule {}
