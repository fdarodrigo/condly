import { Request } from 'express';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { TenantPrismaClient, TenantScope } from '../prisma/tenant-prisma';

export interface RequestComTenant extends Request {
  user?: AuthenticatedUser;
  tenantScope?: TenantScope;
  tenantPrisma?: TenantPrismaClient;
}
