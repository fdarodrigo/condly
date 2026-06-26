import {
  GerarUrlUploadInput,
  GerarUrlUploadOutput,
  R2Client,
} from '../../src/documentos/storage/r2-client.interface';

/**
 * Substitui o R2S3Client real nos testes de integração — nenhum teste deste
 * módulo deve depender de rede ou de credenciais reais do Cloudflare R2.
 * Registra os parâmetros de cada chamada para que os testes possam
 * verificar a regra de expiração da URL de download sem esperar o tempo
 * real passar.
 */
export class FakeR2Client implements R2Client {
  public chamadasUpload: GerarUrlUploadInput[] = [];
  public chamadasDownload: Array<{ key: string; expiresInSeconds: number }> = [];

  async gerarUrlUpload(input: GerarUrlUploadInput): Promise<GerarUrlUploadOutput> {
    this.chamadasUpload.push(input);
    return { url: `https://fake-r2.example.com/upload/${input.key}`, key: input.key };
  }

  async gerarUrlDownload(key: string, expiresInSeconds: number): Promise<string> {
    this.chamadasDownload.push({ key, expiresInSeconds });
    return `https://fake-r2.example.com/download/${key}?expiresIn=${expiresInSeconds}`;
  }
}
