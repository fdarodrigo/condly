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
import { TenantPrismaClient } from '../prisma/tenant-prisma';

@Controller('administradoras')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class AdministradorasController {
  @Get(':administradoraId')
  @Roles('ADMINISTRADORA')
  async findOne(
    @Param('administradoraId') administradoraId: string,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    const administradora = await prisma.administradora.findUnique({
      where: { id: administradoraId },
    });
    if (!administradora) {
      throw new NotFoundException('Administradora não encontrada.');
    }
    return administradora;
  }
}
