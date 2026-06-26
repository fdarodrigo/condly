import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from './prisma.service';
import { buildScopedPrismaClient } from './tenant-prisma';
import { RequestComTenant } from '../common/request-with-tenant.interface';

/**
 * Roda depois dos guards (que já resolveram `request.tenantScope`) e antes do
 * handler do controller. Anexa em `request.tenantPrisma` um client Prisma já
 * filtrado por esse escopo — assim, mesmo que um service esqueça de filtrar
 * manualmente, a query ainda não atravessa pra outro tenant.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestComTenant>();

    request.tenantPrisma = request.tenantScope
      ? buildScopedPrismaClient(this.prisma, request.tenantScope)
      : this.prisma;

    return next.handle();
  }
}
