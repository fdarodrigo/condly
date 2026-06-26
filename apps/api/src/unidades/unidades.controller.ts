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

@Controller('unidades')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class UnidadesController {
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
