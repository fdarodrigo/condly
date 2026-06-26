import { Type } from 'class-transformer';
import { IsString, ValidateNested } from 'class-validator';

class AsaasWebhookPaymentDto {
  @IsString()
  id!: string;

  @IsString()
  status!: string;
}

export class AsaasWebhookPayloadDto {
  @IsString()
  event!: string;

  @ValidateNested()
  @Type(() => AsaasWebhookPaymentDto)
  payment!: AsaasWebhookPaymentDto;
}
