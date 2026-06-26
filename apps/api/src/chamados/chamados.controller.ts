import {
  Body,
  Controller,
  Get,
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

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class ChamadosController {
  constructor(private readonly chamadosService: ChamadosService) {}

  @Post('condominios/:condominioId/chamados')
  @Roles('SINDICO', 'CONDOMINO')
  abrirChamado(
    @Param('condominioId') condominioId: string,
    @Body() dto: CriarChamadoDto,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.chamadosService.abrirChamado(condominioId, dto, usuario, prisma);
  }

  @Get('condominios/:condominioId/chamados')
  @Roles('ADMINISTRADORA', 'SINDICO')
  listarChamados(
    @Param('condominioId') condominioId: string,
    @Query() query: ListarChamadosQueryDto,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.chamadosService.listar(condominioId, query.status, prisma);
  }

  @Patch('chamados/:chamadoId')
  @Roles('SINDICO')
  atualizarChamado(
    @Param('chamadoId') chamadoId: string,
    @Body() dto: AtualizarChamadoDto,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.chamadosService.atualizar(chamadoId, dto, prisma);
  }
}
