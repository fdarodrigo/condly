export const EMAIL_CLIENT = 'EMAIL_CLIENT';

export interface EnviarEmailInput {
  remetenteNome: string;
  destinatarioEmail: string;
  assunto: string;
  corpo: string;
}

export interface EmailClient {
  enviar(input: EnviarEmailInput): Promise<void>;
}
