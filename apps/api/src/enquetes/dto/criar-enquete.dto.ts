import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CriarOpcaoDto {
  @IsString()
  @MinLength(1)
  texto: string;
}

export class CriarEnqueteDto {
  @IsString()
  @MinLength(1)
  titulo: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsEnum(['GESTAO', 'SERVICO'])
  tipo: 'GESTAO' | 'SERVICO';

  @IsOptional()
  @IsBoolean()
  anonima?: boolean;

  @IsISO8601()
  inicioEm: string;

  @IsISO8601()
  fimEm: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CriarOpcaoDto)
  opcoes: CriarOpcaoDto[];

  @IsOptional()
  @IsBoolean()
  gerarAviso?: boolean;
}
