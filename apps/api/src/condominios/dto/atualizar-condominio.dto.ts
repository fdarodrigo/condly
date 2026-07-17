import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class AtualizarCondominioDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @IsOptional()
  @IsString()
  endereco?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsObject()
  permissoesSindico?: Record<string, boolean>;
}
