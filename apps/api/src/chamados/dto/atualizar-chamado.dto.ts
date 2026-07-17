import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { StatusChamado } from '../../../generated/prisma/client';
import { CATEGORIAS_CHAMADO } from './criar-chamado.dto';

export class AtualizarChamadoDto {
  @IsOptional()
  @IsEnum(StatusChamado)
  status?: StatusChamado;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsEnum(CATEGORIAS_CHAMADO)
  categoria?: string;

  @IsOptional()
  @IsString()
  responsavelId?: string;
}
