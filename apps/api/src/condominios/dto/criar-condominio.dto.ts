import { IsOptional, IsString, MinLength, Matches } from 'class-validator';

export class CriarCondominioDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsString()
  @MinLength(5)
  endereco: string;

  @IsString()
  @Matches(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/, { message: 'CNPJ inválido.' })
  cnpj: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  email?: string;
}
