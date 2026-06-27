import { createHmac, timingSafeEqual } from 'node:crypto';

const PREFIXO_ASSINATURA = 'sha256=';

/**
 * Valida o header `X-Hub-Signature-256` que a Meta envia em todo POST do
 * webhook — HMAC-SHA256 do corpo CRU (antes do parse de JSON) usando o App
 * Secret. Mesma postura de "sempre validar antes de processar qualquer
 * payload" já aplicada ao webhook do Asaas (ver CLAUDE.md), estendida pra
 * cobrir qualquer webhook externo, não só os de pagamento — aqui a
 * superfície é ainda mais exposta (não autenticada, qualquer um pode
 * mandar mensagem pro número do WhatsApp).
 */
export function validarAssinaturaWhatsapp(
  corpoCru: Buffer | undefined,
  assinaturaRecebida: string | undefined,
  appSecret: string,
): boolean {
  if (!corpoCru || !assinaturaRecebida || !appSecret) {
    return false;
  }
  if (!assinaturaRecebida.startsWith(PREFIXO_ASSINATURA)) {
    return false;
  }

  const assinaturaEsperada = createHmac('sha256', appSecret).update(corpoCru).digest('hex');
  const recebidoHex = assinaturaRecebida.slice(PREFIXO_ASSINATURA.length);

  const bufferEsperado = Buffer.from(assinaturaEsperada, 'hex');
  const bufferRecebido = Buffer.from(recebidoHex, 'hex');

  // timingSafeEqual lança se os buffers tiverem tamanhos diferentes — em
  // vez de deixar a exceção subir, trata isso como "assinatura inválida"
  // (que de fato é).
  if (bufferEsperado.length !== bufferRecebido.length) {
    return false;
  }
  return timingSafeEqual(bufferEsperado, bufferRecebido);
}
