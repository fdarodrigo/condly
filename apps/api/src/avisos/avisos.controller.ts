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
import { AvisosService } from './avisos.service';
import { CriarAvisoDto } from './dto/criar-aviso.dto';
import { AtualizarAvisoDto } from './dto/atualizar-aviso.dto';
import { PermissoesSindicoService } from '../condominios/permissoes-sindico.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class AvisosController {
  constructor(
    private readonly avisosService: AvisosService,
    private readonly permissoesService: PermissoesSindicoService,
  ) {}

  @Get('condominios/:condominioId/avisos')
  @Roles('ADMINISTRADORA', 'SINDICO', 'CONDOMINO')
  listar(@CurrentTenantPrisma() prisma: TenantPrismaClient) {
    return this.avisosService.listar(prisma);
  }

  @Post('condominios/:condominioId/avisos')
  @Roles('ADMINISTRADORA', 'SINDICO')
  async criar(
    @Param('condominioId') condominioId: string,
    @Body() dto: CriarAvisoDto,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    if (usuario.vinculos.some((v) => v.condominioId === condominioId && v.papel === 'SINDICO')) {
      await this.permissoesService.verificar(condominioId, 'avisosCriar');
    }
    return this.avisosService.criar(condominioId, dto, prisma);
  }

  // Sem @Roles: rota "minha conta", não há condominioId no path para o
  // TenantScopeResolverService resolver — o filtro de tenant aqui é a
  // própria igualdade usuarioId = usuário logado (ver AvisosService).
  @Get('usuarios/me/avisos')
  listarMeusNaoLidos(@CurrentUser() usuario: AuthenticatedUser) {
    return this.avisosService.listarNaoLidos(usuario.usuarioId);
  }

  // Mesmo padrão "minha conta" da rota acima: sem @Roles, o filtro de
  // tenant é a busca pela chave composta [avisoId, usuarioId] dentro do
  // service (ver AvisosService.marcarComoLido).
  @Patch('avisos/:avisoId/marcar-lido')
  marcarComoLido(@Param('avisoId') avisoId: string, @CurrentUser() usuario: AuthenticatedUser) {
    return this.avisosService.marcarComoLido(avisoId, usuario.usuarioId);
  }

  @Patch('avisos/:avisoId')
  @Roles('ADMINISTRADORA', 'SINDICO')
  async atualizar(
    @Param('avisoId') avisoId: string,
    @Body() dto: AtualizarAvisoDto,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    const condominioVinculo = usuario.vinculos.find((v) => v.condominioId && v.papel === 'SINDICO');
    if (condominioVinculo?.condominioId) {
      await this.permissoesService.verificar(condominioVinculo.condominioId, 'avisosEditar');
    }
    return this.avisosService.atualizar(avisoId, dto, prisma);
  }

  @Delete('avisos/:avisoId')
  @Roles('ADMINISTRADORA', 'SINDICO')
  @HttpCode(204)
  async remover(
    @Param('avisoId') avisoId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    const condominioVinculo = usuario.vinculos.find((v) => v.condominioId && v.papel === 'SINDICO');
    if (condominioVinculo?.condominioId) {
      await this.permissoesService.verificar(condominioVinculo.condominioId, 'avisosExcluir');
    }
    return this.avisosService.remover(avisoId, prisma);
  }
}
