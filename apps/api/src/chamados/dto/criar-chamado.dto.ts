import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const CATEGORIAS_CHAMADO = [
  'MANUTENCAO',
  'VAZAMENTO',
  'BARULHO',
  'LIMPEZA',
  'SEGURANCA',
  'ILUMINACAO',
  'ELEVADOR',
  'AREA_COMUM',
  'PORTARIA',
  'OUTRO',
] as const;

export type CategoriaChamado = (typeof CATEGORIAS_CHAMADO)[number];

export class CriarChamadoDto {
  @IsString()
  @IsNotEmpty()
  titulo!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsEnum(CATEGORIAS_CHAMADO)
  categoria!: CategoriaChamado;

  @IsOptional()
  @IsString()
  unidadeId?: string;
}
