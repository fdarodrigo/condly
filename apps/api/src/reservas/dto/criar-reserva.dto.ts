import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CriarReservaDto {
  @IsOptional()
  @IsString()
  unidadeId?: string;

  @IsDateString()
  inicio!: string;

  @IsDateString()
  fim!: string;
}
