import { Injectable } from '@nestjs/common';
import { EmailClient, EnviarEmailInput } from './email-client.interface';

/**
 * Implementação real (via HTTP) do client de e-mail, usando a Resend API.
 * Em testes de integração esse provider é substituído por um fake via
 * `overrideProvider(EMAIL_CLIENT)` — nenhum teste deste módulo envia e-mail
 * real.
 *
 * O nome do remetente é o nome da Administradora (co-branding leve), mas o
 * endereço de envio em si é fixo — é o único domínio verificado na conta
 * Resend, a Administradora não tem domínio próprio cadastrado lá.
 */
@Injectable()
export class ResendEmailClient implements EmailClient {
  private get apiKey(): string {
    return process.env.RESEND_API_KEY ?? '';
  }

  private get remetenteEmail(): string {
    return process.env.RESEND_FROM_EMAIL ?? 'avisos@condly.app';
  }

  async enviar({
    remetenteNome,
    destinatarioEmail,
    assunto,
    corpo,
  }: EnviarEmailInput): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        from: `${remetenteNome} <${this.remetenteEmail}>`,
        to: [destinatarioEmail],
        subject: assunto,
        text: corpo,
      }),
    });

    if (!response.ok) {
      throw new Error(`Falha ao enviar e-mail via Resend (HTTP ${response.status}).`);
    }
  }
}
