import { Controller, Get, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/rbac/roles.guard';
import { Roles } from '../auth/rbac/roles.decorator';
import { TenantInterceptor } from '../prisma/tenant.interceptor';
import { CurrentTenantPrisma } from '../common/current-tenant-prisma.decorator';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { DashboardService } from './dashboard.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('condominios/:condominioId/dashboard')
  @Roles('ADMINISTRADORA', 'SINDICO')
  dashboardCondominio(
    @Param('condominioId') condominioId: string,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.dashboardService.condominio(condominioId, prisma);
  }

  @Get('condominios/:condominioId/dashboard/unidades')
  @Roles('ADMINISTRADORA', 'SINDICO')
  metricasUnidades(
    @Param('condominioId') condominioId: string,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.dashboardService.metricasUnidades(condominioId, prisma);
  }

  // Visão agregada de toda a carteira — só a própria ADMINISTRADORA, nunca
  // um SINDICO (que só gerencia o(s) próprio(s) condomínio(s)).
  @Get('administradoras/:administradoraId/dashboard')
  @Roles('ADMINISTRADORA')
  dashboardAdministradora(
    @Param('administradoraId') administradoraId: string,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.dashboardService.administradora(administradoraId, prisma);
  }
}
