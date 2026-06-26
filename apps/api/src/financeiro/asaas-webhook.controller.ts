import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { FinanceiroService } from './financeiro.service';
import { AsaasWebhookPayloadDto } from './dto/asaas-webhook-payload.dto';

@Controller('webhooks/asaas')
export class AsaasWebhookController {
  constructor(private readonly financeiroService: FinanceiroService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async receber(
    @Headers('asaas-access-token') token: string | undefined,
    @Body() payload: AsaasWebhookPayloadDto,
  ) {
    // Validação ANTES de qualquer leitura do payload, sempre — mesmo em
    // ambiente de teste. Nunca logamos o payload completo, só id/status.
    if (!token || token !== process.env.ASAAS_WEBHOOK_TOKEN) {
      throw new UnauthorizedException('Token de webhook inválido.');
    }

    await this.financeiroService.processarWebhookPagamento(payload);
    return { recebido: true };
  }
}
