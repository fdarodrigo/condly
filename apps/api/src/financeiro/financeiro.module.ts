import { Module } from '@nestjs/common';
import { FinanceiroController } from './financeiro.controller';
import { AsaasWebhookController } from './asaas-webhook.controller';
import { FinanceiroService } from './financeiro.service';
import { ASAAS_CLIENT } from './asaas/asaas-client.interface';
import { AsaasHttpClient } from './asaas/asaas-http-client';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FinanceiroController, AsaasWebhookController],
  providers: [FinanceiroService, { provide: ASAAS_CLIENT, useClass: AsaasHttpClient }],
})
export class FinanceiroModule {}
