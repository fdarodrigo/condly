import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CriarPautaDto {
  @IsString()
  @MinLength(1)
  titulo: string;

  @IsOptional()
  @IsString()
  descricao?: string;
}

export class CriarAssembleiaDto {
  @IsString()
  @MinLength(1)
  titulo: string;

  @IsEnum(['ORDINARIA', 'EXTRAORDINARIA'])
  tipo: 'ORDINARIA' | 'EXTRAORDINARIA';

  @IsISO8601()
  dataHora: string;

  @IsOptional()
  @IsString()
  local?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CriarPautaDto)
  pautas: CriarPautaDto[];
}
