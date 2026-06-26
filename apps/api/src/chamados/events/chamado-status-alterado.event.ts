import { StatusChamado } from '../../../generated/prisma/client';

export const CHAMADO_STATUS_ALTERADO = 'chamado.status_alterado';

export interface ChamadoStatusAlteradoEvent {
  chamadoId: string;
  condominioId: string;
  statusAnterior: StatusChamado | null;
  statusNovo: StatusChamado;
}
