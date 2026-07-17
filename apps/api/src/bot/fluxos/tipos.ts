/**
 * Estado dos fluxos multi-turno do bot, persistido em `ConversaBot.fluxo`
 * (Json). NUNCA é fonte de autoridade — a identidade de quem conversa é
 * resolvida a cada mensagem a partir do telefoneWhatsapp (ver BotService);
 * o fluxo só guarda "em que passo da conversa estamos" e as escolhas já
 * feitas (ids que foram buscados pinados ao condomínio/unidade do próprio
 * usuário no passo anterior).
 */

export interface SlotHorario {
  /** ISO strings — datas em UTC, mesma convenção do resto do produto. */
  inicio: string;
  fim: string;
}

export interface FluxoReservaEstado {
  tipo: 'RESERVA';
  etapa: 'AREA' | 'DIA' | 'HORARIO';
  atualizadoEm: string;
  /** etapa AREA: opções numeradas apresentadas ao usuário */
  areas?: { id: string; nome: string }[];
  /** a partir da etapa DIA */
  areaComumId?: string;
  areaNome?: string;
  /** etapa HORARIO */
  dataISO?: string;
  slots?: SlotHorario[];
}

export interface FluxoChamadoEstado {
  tipo: 'CHAMADO';
  etapa: 'DESCRICAO';
  atualizadoEm: string;
}

export type FluxoEstado = FluxoReservaEstado | FluxoChamadoEstado;

/** Fluxo abandonado no meio expira — a próxima mensagem volta pro menu. */
export const FLUXO_EXPIRACAO_MINUTOS = 30;

/**
 * Lê e valida o Json cru do banco. Qualquer shape inesperado ou fluxo
 * expirado vira `null` (sem fluxo ativo) — nunca lança.
 */
export function lerFluxo(json: unknown): FluxoEstado | null {
  if (!json || typeof json !== 'object') return null;
  const fluxo = json as FluxoEstado;
  if (fluxo.tipo !== 'RESERVA' && fluxo.tipo !== 'CHAMADO') return null;
  if (typeof fluxo.atualizadoEm !== 'string') return null;

  const idadeMs = Date.now() - new Date(fluxo.atualizadoEm).getTime();
  if (!Number.isFinite(idadeMs) || idadeMs > FLUXO_EXPIRACAO_MINUTOS * 60_000) return null;

  return fluxo;
}
