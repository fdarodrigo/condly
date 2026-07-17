import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { CurrentUser } from '../common/current-user.decorator';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { AdvertenciasService } from './advertencias.service';
import { CriarAdvertenciaDto } from './dto/criar-advertencia.dto';
import { PermissoesSindicoService } from '../condominios/permissoes-sindico.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class AdvertenciasController {
  constructor(
    private readonly advertenciasService: AdvertenciasService,
    private readonly permissoesService: PermissoesSindicoService,
  ) {}

  @Post('condominios/:condominioId/advertencias')
  @Roles('ADMINISTRADORA', 'SINDICO')
  async criar(
    @Param('condominioId') condominioId: string,
    @Body() dto: CriarAdvertenciaDto,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    if (usuario.vinculos.some((v) => v.condominioId === condominioId && v.papel === 'SINDICO')) {
      await this.permissoesService.verificar(condominioId, 'advertenciasCriar');
    }
    return this.advertenciasService.criar(condominioId, dto, usuario, tenantPrisma);
  }

  @Get('condominios/:condominioId/advertencias')
  @Roles('ADMINISTRADORA', 'SINDICO')
  listar(
    @Param('condominioId') condominioId: string,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    return this.advertenciasService.listar(condominioId, tenantPrisma);
  }

  // Rota "minha conta": sem @Roles, o filtro é a própria identidade do usuário
  // (unidades dos vínculos CONDOMINO). Mesmo padrão de GET /usuarios/me/avisos.
  @Get('usuarios/me/advertencias')
  listarMinhas(
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    return this.advertenciasService.listarMinhas(usuario, tenantPrisma);
  }

  @Delete('advertencias/:advertenciaId')
  @Roles('ADMINISTRADORA', 'SINDICO')
  @HttpCode(204)
  async remover(
    @Param('advertenciaId') advertenciaId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    const condominioVinculo = usuario.vinculos.find((v) => v.condominioId && v.papel === 'SINDICO');
    if (condominioVinculo?.condominioId) {
      await this.permissoesService.verificar(condominioVinculo.condominioId, 'advertenciasExcluir');
    }
    return this.advertenciasService.remover(advertenciaId, tenantPrisma);
  }
}
