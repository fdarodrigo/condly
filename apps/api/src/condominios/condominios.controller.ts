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

@Controller('condominios')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class CondominiosController {
  @Get(':condominioId')
  @Roles('ADMINISTRADORA', 'SINDICO')
  async findOne(
    @Param('condominioId') condominioId: string,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    const condominio = await prisma.condominio.findUnique({ where: { id: condominioId } });
    if (!condominio) {
      throw new NotFoundException('Condomínio não encontrado.');
    }
    return condominio;
  }
}
