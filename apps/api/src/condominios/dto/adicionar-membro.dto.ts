import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class AdicionarMembroDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  senha?: string;

  @IsOptional()
  @IsString()
  telefoneWhatsapp?: string;

  @IsEnum(['SINDICO', 'CONDOMINO'])
  papel: 'SINDICO' | 'CONDOMINO';

  @IsOptional()
  @IsString()
  unidadeId?: string;
}
