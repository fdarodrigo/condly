import { IsOptional, IsString, MinLength } from 'class-validator';

export class AtualizarAvisoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  corpo?: string;
}
