import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class AdicionarDocumentoDto {
  @IsString()
  @MinLength(1)
  titulo: string;

  @IsOptional()
  @IsUrl()
  url?: string;
}
