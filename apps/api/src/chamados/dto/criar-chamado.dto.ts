import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CriarChamadoDto {
  @IsString()
  @IsNotEmpty()
  categoria!: string;

  @IsOptional()
  @IsString()
  unidadeId?: string;
}
