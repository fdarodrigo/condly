import { IsBoolean, IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class CriarAcaoAdministrativaDto {
  @IsString()
  @MinLength(1)
  titulo: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsISO8601()
  realizadaEm: string;

  @IsOptional()
  @IsISO8601()
  validoAte?: string;

  @IsOptional()
  @IsBoolean()
  gerarAviso?: boolean;
}
