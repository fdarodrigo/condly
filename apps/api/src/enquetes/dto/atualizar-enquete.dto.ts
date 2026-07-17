import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class AtualizarEnqueteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsISO8601()
  inicioEm?: string;

  @IsOptional()
  @IsISO8601()
  fimEm?: string;
}
