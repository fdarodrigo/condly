/**
 * Identidade resolvida pro telefone de origem da mensagem — NUNCA derivada
 * do texto da mensagem em si (regra inegociável do módulo, ver CLAUDE.md).
 * Quando o telefone não está cadastrado em nenhum Usuario, ou o Usuario não
 * tem nenhum vínculo com unidade, o resultado é `null` e o bot orienta o
 * cadastro pelo app.
 */
export interface IdentidadeResolvida {
  usuarioId: string;
  unidadeId: string;
  condominioId: string;
  identificadorUnidade: string;
}
