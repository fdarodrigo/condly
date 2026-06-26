import { IsEnum, IsOptional } from 'class-validator';
import { StatusChamado } from '../../../generated/prisma/client';

export class ListarChamadosQueryDto {
  @IsOptional()
  @IsEnum(StatusChamado)
  status?: StatusChamado;
}
