import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
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

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class AvisosController {
  constructor(private readonly avisosService: AvisosService) {}

  @Post('condominios/:condominioId/avisos')
  @Roles('ADMINISTRADORA', 'SINDICO')
  criar(
    @Param('condominioId') condominioId: string,
    @Body() dto: CriarAvisoDto,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.avisosService.criar(condominioId, dto, prisma);
  }

  // Sem @Roles: rota "minha conta", não há condominioId no path para o
  // TenantScopeResolverService resolver — o filtro de tenant aqui é a
  // própria igualdade usuarioId = usuário logado (ver AvisosService).
  @Get('usuarios/me/avisos')
  listarMeusNaoLidos(@CurrentUser() usuario: AuthenticatedUser) {
    return this.avisosService.listarNaoLidos(usuario.usuarioId);
  }
}
