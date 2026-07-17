import { Injectable } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GerarUrlUploadInput, GerarUrlUploadOutput, R2Client } from './r2-client.interface';

const UPLOAD_URL_EXPIRES_IN_SECONDS = 5 * 60;

/**
 * Implementação real (via S3 SDK, compatível com R2) do client de storage.
 * Em testes de integração esse provider é substituído por um fake via
 * `overrideProvider(R2_CLIENT)` — nenhum teste deste módulo depende de rede
 * ou de credenciais reais do Cloudflare R2.
 */
@Injectable()
export class R2S3Client implements R2Client {
  private get bucket(): string {
    return process.env.R2_BUCKET_NAME ?? '';
  }

  private get client(): S3Client {
    const customEndpoint = process.env.R2_ENDPOINT;
    return new S3Client({
      region: 'auto',
      endpoint: customEndpoint ?? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      // MinIO (dev local) usa path-style; R2 usa virtual-hosted
      forcePathStyle: !!customEndpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      },
    });
  }

  async gerarUrlUpload({ key, contentType }: GerarUrlUploadInput): Promise<GerarUrlUploadOutput> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: UPLOAD_URL_EXPIRES_IN_SECONDS,
    });
    return { url, key };
  }

  async gerarUrlDownload(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async uploadDireto(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }
}
