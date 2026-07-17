import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export const MOTIVOS_ADVERTENCIA = [
  'BARULHO',
  'DESCUMPRIMENTO_REGRAS',
  'DANO_PATRIMONIO',
  'INADIMPLENCIA',
  'CONDUTA_INADEQUADA',
  'OUTRO',
] as const;

export type MotivoAdvertencia = (typeof MOTIVOS_ADVERTENCIA)[number];

export class CriarAdvertenciaDto {
  @IsString()
  @IsNotEmpty()
  unidadeId!: string;

  @IsEnum(MOTIVOS_ADVERTENCIA)
  motivo!: MotivoAdvertencia;

  @IsString()
  @IsNotEmpty()
  descricao!: string;
}
