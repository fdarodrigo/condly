import { ArrayNotEmpty, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CanalAviso } from '../../../generated/prisma/client';

export class CriarAvisoDto {
  @IsString()
  @IsNotEmpty()
  titulo!: string;

  @IsString()
  @IsNotEmpty()
  corpo!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(CanalAviso, { each: true })
  canais!: CanalAviso[];

  @IsOptional()
  @IsString()
  unidadeId?: string;
}
