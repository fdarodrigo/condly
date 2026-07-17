import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AtualizarPautaDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  deliberacao?: string;
}

export class AtualizarAssembleiaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  titulo?: string;

  @IsOptional()
  @IsEnum(['ORDINARIA', 'EXTRAORDINARIA'])
  tipo?: 'ORDINARIA' | 'EXTRAORDINARIA';

  @IsOptional()
  @IsISO8601()
  dataHora?: string;

  @IsOptional()
  @IsString()
  local?: string;

  @IsOptional()
  @IsString()
  linkGravacao?: string;

  @IsOptional()
  @IsEnum(['AGENDADA', 'REALIZADA', 'CANCELADA'])
  status?: 'AGENDADA' | 'REALIZADA' | 'CANCELADA';

  @IsOptional()
  @IsNumber()
  @IsPositive()
  acrescimoTaxa?: number;

  @IsOptional()
  @IsISO8601()
  acrescimoAte?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AtualizarPautaDto)
  pautas?: AtualizarPautaDto[];
}
