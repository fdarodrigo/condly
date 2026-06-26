export const CHAMADO_REABERTO = 'chamado.reaberto';

export interface ChamadoReabertoEvent {
  chamadoId: string;
  condominioId: string;
  reabertoEm: Date;
}
