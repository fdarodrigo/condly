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
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { AcoesAdministrativasService } from './acoes-administrativas.service';
import { CriarAcaoAdministrativaDto } from './dto/criar-acao-administrativa.dto';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { PermissoesSindicoService } from '../condominios/permissoes-sindico.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class AcoesAdministrativasController {
  constructor(
    private readonly service: AcoesAdministrativasService,
    private readonly permissoesService: PermissoesSindicoService,
  ) {}

  @Get('condominios/:condominioId/acoes-administrativas')
  @Roles('ADMINISTRADORA', 'SINDICO')
  listar(@CurrentTenantPrisma() prisma: TenantPrismaClient) {
    return this.service.listar(prisma);
  }

  @Post('condominios/:condominioId/acoes-administrativas')
  @Roles('ADMINISTRADORA', 'SINDICO')
  async criar(
    @Param('condominioId') condominioId: string,
    @Body() dto: CriarAcaoAdministrativaDto,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    if (usuario.vinculos.some((v) => v.condominioId === condominioId && v.papel === 'SINDICO')) {
      await this.permissoesService.verificar(condominioId, 'acoesAdmCriar');
    }
    return this.service.criar(condominioId, dto, prisma);
  }

  @Delete('acoes-administrativas/:acaoId')
  @Roles('ADMINISTRADORA', 'SINDICO')
  @HttpCode(204)
  async remover(
    @Param('acaoId') acaoId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    const condominioVinculo = usuario.vinculos.find((v) => v.condominioId && v.papel === 'SINDICO');
    if (condominioVinculo?.condominioId) {
      await this.permissoesService.verificar(condominioVinculo.condominioId, 'acoesAdmExcluir');
    }
    return this.service.remover(acaoId, prisma);
  }
}
