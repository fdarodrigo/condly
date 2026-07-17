import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class AtualizarRegrasDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'horarioAbertura deve estar no formato HH:MM.' })
  horarioAbertura?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'horarioFechamento deve estar no formato HH:MM.' })
  horarioFechamento?: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  duracaoMinimaMinutos?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  antecedenciaMaximaDias?: number;
}
