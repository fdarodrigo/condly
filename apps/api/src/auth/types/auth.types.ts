import { PapelVinculo } from '../../../generated/prisma/client';

export interface VinculoToken {
  papel: PapelVinculo;
  administradoraId?: string;
  condominioId?: string;
  unidadeId?: string;
}

export interface JwtPayload {
  sub: string;
  vinculos: VinculoToken[];
}

export interface AuthenticatedUser {
  usuarioId: string;
  vinculos: VinculoToken[];
}
