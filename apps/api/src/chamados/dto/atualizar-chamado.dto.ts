import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { StatusChamado } from '../../../generated/prisma/client';

export class AtualizarChamadoDto {
  @IsOptional()
  @IsEnum(StatusChamado)
  status?: StatusChamado;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoria?: string;

  @IsOptional()
  @IsString()
  responsavelId?: string;
}
