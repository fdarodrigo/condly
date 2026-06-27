import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/rbac/roles.guard';
import { Roles } from '../auth/rbac/roles.decorator';
import { TenantInterceptor } from '../prisma/tenant.interceptor';
import { CurrentTenantPrisma } from '../common/current-tenant-prisma.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { UnidadesService } from './unidades.service';

@Controller('unidades')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class UnidadesController {
  constructor(private readonly unidadesService: UnidadesService) {}

  // Sem @Roles: rota "minha conta" (ver UnidadesService.meuSaldo) — por
  // isso precisa vir ANTES de ':unidadeId' abaixo, senão o Nest casaria
  // "me" como valor literal do path param `:unidadeId`.
  @Get('me/saldo')
  meuSaldo(@CurrentUser() usuario: AuthenticatedUser) {
    return this.unidadesService.meuSaldo(usuario.usuarioId);
  }

  @Get(':unidadeId')
  @Roles('ADMINISTRADORA', 'SINDICO', 'CONDOMINO')
  async findOne(
    @Param('unidadeId') unidadeId: string,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId } });
    if (!unidade) {
      throw new NotFoundException('Unidade não encontrada.');
    }
    return unidade;
  }
}
