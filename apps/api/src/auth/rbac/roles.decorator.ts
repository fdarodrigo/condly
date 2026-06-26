import { SetMetadata } from '@nestjs/common';
import { PapelVinculo } from '../../../generated/prisma/client';

export const ROLES_KEY = 'roles';

export const Roles = (...papeis: PapelVinculo[]) => SetMetadata(ROLES_KEY, papeis);
