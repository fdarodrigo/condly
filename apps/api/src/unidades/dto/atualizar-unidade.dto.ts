import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class AtualizarUnidadeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  identificador?: string;

  @IsOptional()
  @IsEnum(['APARTAMENTO', 'CASA', 'SALA_COMERCIAL', 'VAGA', 'OUTRO'])
  tipo?: string;

  @IsOptional()
  @IsString()
  responsavelNome?: string;

  @IsOptional()
  @IsString()
  responsavelEmail?: string;

  @IsOptional()
  @IsString()
  responsavelCpfCnpj?: string;
}
