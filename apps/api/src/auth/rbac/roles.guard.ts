import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PapelVinculo } from '../../../generated/prisma/client';
import { ROLES_KEY } from './roles.decorator';
import { TenantScopeResolverService } from './tenant-scope-resolver.service';
import { RequestComTenant } from '../../common/request-with-tenant.interface';
import { TenantScope } from '../../prisma/tenant-prisma';
import { VinculoToken } from '../types/auth.types';

/**
 * Checagem de escopo é por papel, não por "qualquer campo bate":
 * - ADMINISTRADORA enxerga toda a árvore da própria administradora.
 * - SINDICO enxerga todo o condomínio, inclusive as unidades dele.
 * - CONDOMINO só enxerga a própria unidade quando o recurso é de uma
 *   unidade específica; quando o recurso é de nível condomínio (ex: abrir
 *   um chamado, sem unidade alvo), o condominioId resolvido no login (a
 *   partir da própria unidade) autoriza. Sem essa distinção por papel, o
 *   condômino ganharia acesso a OUTRAS unidades do mesmo condomínio só por
 *   o condominioId do seu vínculo bater.
 */
function vinculoAutoriza(vinculo: VinculoToken, scope: TenantScope): boolean {
  switch (vinculo.papel) {
    case 'ADMINISTRADORA':
      return !!vinculo.administradoraId && vinculo.administradoraId === scope.administradoraId;
    case 'SINDICO':
      return !!vinculo.condominioId && vinculo.condominioId === scope.condominioId;
    case 'CONDOMINO':
      if (scope.unidadeId) {
        return !!vinculo.unidadeId && vinculo.unidadeId === scope.unidadeId;
      }
      return !!vinculo.condominioId && vinculo.condominioId === scope.condominioId;
    default:
      return false;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly scopeResolver: TenantScopeResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<PapelVinculo[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestComTenant>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }

    const scope = await this.scopeResolver.resolve(request.params as Record<string, string>);
    request.tenantScope = scope;

    const autorizado = user.vinculos.some(
      (vinculo) => requiredRoles.includes(vinculo.papel) && vinculoAutoriza(vinculo, scope),
    );

    if (!autorizado) {
      throw new ForbiddenException('Você não tem permissão para acessar este recurso.');
    }

    return true;
  }
}
