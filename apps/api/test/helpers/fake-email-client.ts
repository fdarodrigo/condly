import { EmailClient, EnviarEmailInput } from '../../src/avisos/email/email-client.interface';

/**
 * Substitui o ResendEmailClient real nos testes de integração — nenhum
 * teste deste módulo deve depender de rede ou enviar e-mail real.
 */
export class FakeEmailClient implements EmailClient {
  public chamadas: EnviarEmailInput[] = [];

  async enviar(input: EnviarEmailInput): Promise<void> {
    this.chamadas.push(input);
  }
}
