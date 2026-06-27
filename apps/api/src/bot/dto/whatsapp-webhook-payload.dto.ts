import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

class WhatsappWebhookTextDto {
  @IsString()
  body!: string;
}

// Reflete só o que o bot lê do payload oficial da Meta — outros campos
// (metadata, contacts, statuses de entrega...) chegam mas não interessam
// aqui, e o ValidationPipe global (`whitelist: true`) os descarta.
class WhatsappWebhookMessageDto {
  @IsString()
  from!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsappWebhookTextDto)
  text?: WhatsappWebhookTextDto;
}

class WhatsappWebhookValueDto {
  // Webhooks de status de entrega (sent/delivered/read) chegam sem
  // `messages` — só presente quando o evento é uma mensagem entrante.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsappWebhookMessageDto)
  messages?: WhatsappWebhookMessageDto[];
}

class WhatsappWebhookChangeDto {
  @ValidateNested()
  @Type(() => WhatsappWebhookValueDto)
  value!: WhatsappWebhookValueDto;
}

class WhatsappWebhookEntryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsappWebhookChangeDto)
  changes!: WhatsappWebhookChangeDto[];
}

export class WhatsappWebhookPayloadDto {
  @IsString()
  object!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsappWebhookEntryDto)
  entry!: WhatsappWebhookEntryDto[];
}
