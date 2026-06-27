import { createHmac } from 'node:crypto';
import { validarAssinaturaWhatsapp } from './whatsapp-signature.util';

const APP_SECRET = 'segredo-de-teste';

function assinar(corpo: string, secret = APP_SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(corpo).digest('hex')}`;
}

describe('validarAssinaturaWhatsapp', () => {
  it('aceita uma assinatura HMAC-SHA256 calculada corretamente', () => {
    const corpo = Buffer.from('{"object":"whatsapp_business_account"}');
    const assinatura = assinar(corpo.toString());

    expect(validarAssinaturaWhatsapp(corpo, assinatura, APP_SECRET)).toBe(true);
  });

  it('rejeita quando o corpo foi alterado depois de assinado', () => {
    const corpoOriginal = '{"valor":1}';
    const assinatura = assinar(corpoOriginal);
    const corpoAlterado = Buffer.from('{"valor":2}');

    expect(validarAssinaturaWhatsapp(corpoAlterado, assinatura, APP_SECRET)).toBe(false);
  });

  it('rejeita quando o App Secret usado não é o configurado', () => {
    const corpo = '{"x":1}';
    const assinatura = assinar(corpo, 'outro-secret-qualquer');

    expect(validarAssinaturaWhatsapp(Buffer.from(corpo), assinatura, APP_SECRET)).toBe(false);
  });

  it('rejeita sem lançar erro quando faltam corpo, assinatura ou secret', () => {
    expect(validarAssinaturaWhatsapp(undefined, 'sha256=abc', APP_SECRET)).toBe(false);
    expect(validarAssinaturaWhatsapp(Buffer.from('x'), undefined, APP_SECRET)).toBe(false);
    expect(validarAssinaturaWhatsapp(Buffer.from('x'), 'sha256=abc', '')).toBe(false);
  });

  it('rejeita sem lançar erro quando a assinatura não tem o prefixo sha256= ou tem tamanho inválido', () => {
    expect(validarAssinaturaWhatsapp(Buffer.from('x'), 'abc123', APP_SECRET)).toBe(false);
    expect(validarAssinaturaWhatsapp(Buffer.from('x'), 'sha256=ab', APP_SECRET)).toBe(false);
  });
});
