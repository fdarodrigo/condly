import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
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
import { ChamadosService } from './chamados.service';
import { CriarChamadoDto } from './dto/criar-chamado.dto';
import { AtualizarChamadoDto } from './dto/atualizar-chamado.dto';
import { ListarChamadosQueryDto } from './dto/listar-chamados-query.dto';
import { PermissoesSindicoService } from '../condominios/permissoes-sindico.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class ChamadosController {
  constructor(
    private readonly chamadosService: ChamadosService,
    private readonly permissoesService: PermissoesSindicoService,
  ) {}

  @Post('condominios/:condominioId/chamados')
  @Roles('ADMINISTRADORA', 'SINDICO', 'CONDOMINO')
  async abrirChamado(
    @Param('condominioId') condominioId: string,
    @Body() dto: CriarChamadoDto,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    if (usuario.vinculos.some((v) => v.condominioId === condominioId && v.papel === 'SINDICO')) {
      await this.permissoesService.verificar(condominioId, 'chamadosCriar');
    }
    return this.chamadosService.abrirChamado(condominioId, dto, usuario, prisma);
  }

  @Get('condominios/:condominioId/chamados')
  @Roles('ADMINISTRADORA', 'SINDICO', 'CONDOMINO')
  listarChamados(
    @Param('condominioId') condominioId: string,
    @Query() query: ListarChamadosQueryDto,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.chamadosService.listar(condominioId, query.status, usuario, prisma);
  }

  @Patch('chamados/:chamadoId')
  @Roles('ADMINISTRADORA', 'SINDICO')
  async atualizarChamado(
    @Param('chamadoId') chamadoId: string,
    @Body() dto: AtualizarChamadoDto,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    const condominioVinculo = usuario.vinculos.find((v) => v.condominioId && v.papel === 'SINDICO');
    if (condominioVinculo?.condominioId) {
      await this.permissoesService.verificar(
        condominioVinculo.condominioId,
        'chamadosAlterarStatus',
      );
    }
    return this.chamadosService.atualizar(chamadoId, dto, prisma);
  }

  @Delete('chamados/:chamadoId')
  @Roles('ADMINISTRADORA', 'SINDICO')
  @HttpCode(204)
  async removerChamado(
    @Param('chamadoId') chamadoId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    const condominioVinculo = usuario.vinculos.find((v) => v.condominioId && v.papel === 'SINDICO');
    if (condominioVinculo?.condominioId) {
      await this.permissoesService.verificar(condominioVinculo.condominioId, 'chamadosExcluir');
    }
    return this.chamadosService.remover(chamadoId, prisma);
  }
}
