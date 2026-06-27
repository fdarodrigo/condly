import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { BotService } from './bot.service';
import { WhatsappWebhookPayloadDto } from './dto/whatsapp-webhook-payload.dto';
import { validarAssinaturaWhatsapp } from './whatsapp-signature.util';

@Controller('webhooks/whatsapp')
export class BotController {
  constructor(private readonly botService: BotService) {}

  /**
   * Handshake de verificação exigido pela Meta ao cadastrar a URL do
   * webhook no painel — confere `hub.verify_token` contra o valor
   * configurado e, se bater, devolve `hub.challenge` em texto puro.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  verificar(
    @Query('hub.mode') modo: string | undefined,
    @Query('hub.verify_token') tokenRecebido: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
  ): string {
    if (
      modo !== 'subscribe' ||
      !tokenRecebido ||
      tokenRecebido !== process.env.WHATSAPP_VERIFY_TOKEN
    ) {
      throw new UnauthorizedException('Token de verificação inválido.');
    }
    return challenge ?? '';
  }

  /**
   * Validação da assinatura ANTES de qualquer leitura do payload, sempre —
   * mesmo regra já aplicada ao webhook do Asaas, estendida aqui porque essa
   * superfície é não autenticada (qualquer telefone pode mandar mensagem).
   * Precisa do corpo CRU (`rawBody`, habilitado em main.ts) porque o HMAC é
   * calculado sobre os bytes exatos recebidos, não sobre o objeto já
   * parseado/validado pelo ValidationPipe.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async receber(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') assinatura: string | undefined,
    @Body() payload: WhatsappWebhookPayloadDto,
  ) {
    if (
      !validarAssinaturaWhatsapp(request.rawBody, assinatura, process.env.WHATSAPP_APP_SECRET ?? '')
    ) {
      throw new UnauthorizedException('Assinatura do webhook inválida.');
    }

    const mensagens = payload.entry.flatMap((entrada) =>
      entrada.changes.flatMap((mudanca) => mudanca.value.messages ?? []),
    );

    for (const mensagem of mensagens) {
      if (!mensagem.text?.body) {
        continue;
      }
      await this.botService.processarMensagemEntrante(mensagem.from, mensagem.text.body);
    }

    return { recebido: true };
  }
}
