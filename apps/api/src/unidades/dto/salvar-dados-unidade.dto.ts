import { IsArray, IsBoolean, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const STATUS_OCUPACAO = ['PROPRIETARIO', 'INQUILINO', 'VAZIA'] as const;
export type StatusOcupacao = (typeof STATUS_OCUPACAO)[number];

export class VeiculoDto {
  @IsString() placa!: string;
  @IsString() modelo!: string;
  @IsString() cor!: string;
}

export class SalvarDadosUnidadeDto {
  @IsOptional() @IsBoolean() bebeRecemNascido?: boolean;
  @IsOptional() @IsBoolean() trabalhadorNoturno?: boolean;
  @IsOptional() @IsBoolean() pessoasIdosas?: boolean;
  @IsOptional() @IsBoolean() pets?: boolean;
  @IsOptional() @IsString() petsDescricao?: string;
  @IsOptional() @IsBoolean() pessoasAutismo?: boolean;
  @IsOptional() @IsString() pessoasAutismoDescricao?: string;
  @IsOptional() @IsBoolean() estrangeiros?: boolean;
  @IsOptional() @IsBoolean() mobilidadeReduzida?: boolean;
  @IsOptional() @IsBoolean() locacaoCurtaTemporada?: boolean;
  @IsOptional() @IsIn(STATUS_OCUPACAO) statusOcupacao?: StatusOcupacao;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VeiculoDto)
  veiculos?: VeiculoDto[];
  @IsOptional() @IsString() contatoEmergenciaNome?: string;
  @IsOptional() @IsString() contatoEmergenciaTelefone?: string;
}
