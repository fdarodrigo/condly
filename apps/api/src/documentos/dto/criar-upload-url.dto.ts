import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { VisibilidadeDocumento } from '../../../generated/prisma/client';

// Restringe a tipos de arquivo que o módulo de documentos realmente precisa
// suportar — evita assinar upload de tipos arbitrários (ex: text/html) para
// um objeto que depois pode ser servido de volta para outro usuário.
export const TIPOS_MIME_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export class CriarUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  tipo!: string;

  @IsEnum(VisibilidadeDocumento)
  visibilidade!: VisibilidadeDocumento;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nomeArquivo?: string;

  @IsOptional()
  @IsString()
  @IsIn(TIPOS_MIME_PERMITIDOS)
  contentType?: string;
}
