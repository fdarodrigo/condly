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
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { AssembleiasService } from './assembleias.service';
import { CriarAssembleiaDto } from './dto/criar-assembleia.dto';
import { AtualizarAssembleiaDto } from './dto/atualizar-assembleia.dto';
import { AdicionarDocumentoDto } from './dto/adicionar-documento.dto';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { PermissoesSindicoService } from '../condominios/permissoes-sindico.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class AssembleiasController {
  constructor(
    private readonly assembleiasService: AssembleiasService,
    private readonly permissoesService: PermissoesSindicoService,
  ) {}

  @Get('condominios/:condominioId/assembleias')
  @Roles('ADMINISTRADORA', 'SINDICO', 'CONDOMINO')
  listar(
    @Param('condominioId') condominioId: string,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    return this.assembleiasService.listar(condominioId, tenantPrisma);
  }

  @Post('condominios/:condominioId/assembleias')
  @Roles('ADMINISTRADORA', 'SINDICO')
  async criar(
    @Param('condominioId') condominioId: string,
    @Body() dto: CriarAssembleiaDto,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    if (usuario.vinculos.some((v) => v.condominioId === condominioId && v.papel === 'SINDICO')) {
      await this.permissoesService.verificar(condominioId, 'assembleiasCriar');
    }
    return this.assembleiasService.criar(condominioId, dto, tenantPrisma);
  }

  @Patch('assembleias/:assembleiaId')
  @Roles('ADMINISTRADORA', 'SINDICO')
  async atualizar(
    @Param('assembleiaId') assembleiaId: string,
    @Body() dto: AtualizarAssembleiaDto,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    const condominioVinculo = usuario.vinculos.find((v) => v.condominioId && v.papel === 'SINDICO');
    if (condominioVinculo?.condominioId) {
      if (dto.status === 'REALIZADA') {
        await this.permissoesService.verificar(
          condominioVinculo.condominioId,
          'assembleiasRegistrarResultados',
        );
      } else if (dto.status === 'CANCELADA') {
        await this.permissoesService.verificar(
          condominioVinculo.condominioId,
          'assembleiasCancelar',
        );
      }
    }
    return this.assembleiasService.atualizar(assembleiaId, dto, tenantPrisma);
  }

  @Delete('assembleias/:assembleiaId')
  @Roles('ADMINISTRADORA', 'SINDICO')
  @HttpCode(204)
  async remover(
    @Param('assembleiaId') assembleiaId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    const condominioVinculo = usuario.vinculos.find((v) => v.condominioId && v.papel === 'SINDICO');
    if (condominioVinculo?.condominioId) {
      await this.permissoesService.verificar(condominioVinculo.condominioId, 'assembleiasExcluir');
    }
    return this.assembleiasService.remover(assembleiaId, tenantPrisma);
  }

  @Post('assembleias/:assembleiaId/documentos')
  @Roles('ADMINISTRADORA', 'SINDICO')
  adicionarDocumento(
    @Param('assembleiaId') assembleiaId: string,
    @Body() dto: AdicionarDocumentoDto,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    return this.assembleiasService.adicionarDocumento(assembleiaId, dto, tenantPrisma);
  }

  @Delete('assembleias/:assembleiaId/documentos/:docId')
  @Roles('ADMINISTRADORA', 'SINDICO')
  @HttpCode(204)
  removerDocumento(
    @Param('assembleiaId') assembleiaId: string,
    @Param('docId') docId: string,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    return this.assembleiasService.removerDocumento(assembleiaId, docId, tenantPrisma);
  }
}
