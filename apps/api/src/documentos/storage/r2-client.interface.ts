export const R2_CLIENT = 'R2_CLIENT';

export interface GerarUrlUploadInput {
  key: string;
  contentType: string;
}

export interface GerarUrlUploadOutput {
  url: string;
  key: string;
}

export interface R2Client {
  gerarUrlUpload(input: GerarUrlUploadInput): Promise<GerarUrlUploadOutput>;
  gerarUrlDownload(key: string, expiresInSeconds: number): Promise<string>;
}
