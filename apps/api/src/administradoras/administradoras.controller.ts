import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/rbac/roles.guard';
import { Roles } from '../auth/rbac/roles.decorator';
import { TenantInterceptor } from '../prisma/tenant.interceptor';
import { CurrentTenantPrisma } from '../common/current-tenant-prisma.decorator';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { CondominiosService } from '../condominios/condominios.service';
import { CriarCondominioDto } from '../condominios/dto/criar-condominio.dto';

@Controller('administradoras')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class AdministradorasController {
  constructor(private readonly condominiosService: CondominiosService) {}
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

  @Post(':administradoraId/condominios')
  @Roles('ADMINISTRADORA')
  criarCondominio(
    @Param('administradoraId') administradoraId: string,
    @Body() dto: CriarCondominioDto,
  ) {
    return this.condominiosService.criar(administradoraId, dto);
  }

  @Get(':administradoraId/condominios')
  @Roles('ADMINISTRADORA')
  async listarCondominios(
    @Param('administradoraId') administradoraId: string,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return prisma.condominio.findMany({
      where: { administradoraId },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  }
}
