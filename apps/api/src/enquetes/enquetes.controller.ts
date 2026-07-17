import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
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
import { EnquetesService } from './enquetes.service';
import { CriarEnqueteDto } from './dto/criar-enquete.dto';
import { AtualizarEnqueteDto } from './dto/atualizar-enquete.dto';
import { VotarDto } from './dto/votar.dto';
import { PermissoesSindicoService } from '../condominios/permissoes-sindico.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class EnquetesController {
  constructor(
    private readonly enquetesService: EnquetesService,
    private readonly permissoesService: PermissoesSindicoService,
  ) {}

  @Get('condominios/:condominioId/enquetes')
  @Roles('ADMINISTRADORA', 'SINDICO', 'CONDOMINO')
  listar(
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.enquetesService.listar(prisma, usuario.usuarioId);
  }

  @Post('condominios/:condominioId/enquetes')
  @Roles('ADMINISTRADORA', 'SINDICO')
  async criar(
    @Param('condominioId') condominioId: string,
    @Body() dto: CriarEnqueteDto,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    if (usuario.vinculos.some((v) => v.condominioId === condominioId && v.papel === 'SINDICO')) {
      await this.permissoesService.verificar(condominioId, 'enquetesCriar');
    }
    return this.enquetesService.criar(condominioId, dto, prisma);
  }

  @Patch('enquetes/:enqueteId')
  @Roles('ADMINISTRADORA', 'SINDICO')
  atualizar(
    @Param('enqueteId') enqueteId: string,
    @Body() dto: AtualizarEnqueteDto,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.enquetesService.atualizar(enqueteId, dto, prisma);
  }

  @Patch('enquetes/:enqueteId/publicar')
  @Roles('ADMINISTRADORA', 'SINDICO')
  publicar(
    @Param('enqueteId') enqueteId: string,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.enquetesService.publicar(enqueteId, prisma);
  }

  @Patch('enquetes/:enqueteId/encerrar')
  @Roles('ADMINISTRADORA', 'SINDICO')
  async encerrar(
    @Param('enqueteId') enqueteId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    const condominioVinculo = usuario.vinculos.find((v) => v.condominioId && v.papel === 'SINDICO');
    if (condominioVinculo?.condominioId) {
      await this.permissoesService.verificar(condominioVinculo.condominioId, 'enquetesEncerrar');
    }
    return this.enquetesService.encerrar(enqueteId, prisma);
  }

  @Delete('enquetes/:enqueteId')
  @Roles('ADMINISTRADORA', 'SINDICO')
  @HttpCode(204)
  async remover(
    @Param('enqueteId') enqueteId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    const condominioVinculo = usuario.vinculos.find((v) => v.condominioId && v.papel === 'SINDICO');
    if (condominioVinculo?.condominioId) {
      await this.permissoesService.verificar(condominioVinculo.condominioId, 'enquetesExcluir');
    }
    return this.enquetesService.remover(enqueteId, prisma);
  }

  @Post('enquetes/:enqueteId/votar')
  @Roles('ADMINISTRADORA', 'SINDICO', 'CONDOMINO')
  votar(
    @Param('enqueteId') enqueteId: string,
    @Body() dto: VotarDto,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.enquetesService.votar(enqueteId, dto, prisma, usuario.usuarioId);
  }
}
