import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CriarUnidadeDto {
  @IsString()
  @MinLength(1)
  identificador: string;

  @IsEnum(['APARTAMENTO', 'CASA', 'SALA_COMERCIAL', 'VAGA', 'OUTRO'])
  tipo: string;

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
