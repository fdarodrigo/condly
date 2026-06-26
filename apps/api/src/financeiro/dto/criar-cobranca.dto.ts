import { IsDateString, IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class CriarCobrancaDto {
  @IsString()
  @IsNotEmpty()
  unidadeId!: string;

  @IsNumber()
  @IsPositive()
  valor!: number;

  @IsDateString()
  vencimento!: string;
}
