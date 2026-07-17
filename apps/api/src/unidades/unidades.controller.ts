import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
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
import { UnidadesService } from './unidades.service';
import { DadosUnidadeService } from './dados-unidade.service';
import { CriarUnidadeDto } from './dto/criar-unidade.dto';
import { AtualizarUnidadeDto } from './dto/atualizar-unidade.dto';
import { SalvarDadosUnidadeDto } from './dto/salvar-dados-unidade.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class UnidadesController {
  constructor(
    private readonly unidadesService: UnidadesService,
    private readonly dadosUnidadeService: DadosUnidadeService,
  ) {}

  // Sem @Roles: rota "minha conta" — ANTES de ':unidadeId' pra não ser
  // capturada como path param literal.
  @Get('unidades/me/saldo')
  meuSaldo(@CurrentUser() usuario: AuthenticatedUser) {
    return this.unidadesService.meuSaldo(usuario.usuarioId);
  }

  @Get('unidades/:unidadeId')
  @Roles('ADMINISTRADORA', 'SINDICO', 'CONDOMINO')
  async findOne(
    @Param('unidadeId') unidadeId: string,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId } });
    if (!unidade) throw new NotFoundException('Unidade não encontrada.');
    return unidade;
  }

  @Get('condominios/:condominioId/unidades')
  @Roles('ADMINISTRADORA', 'SINDICO')
  listar(
    @Param('condominioId') condominioId: string,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    return this.unidadesService.listar(condominioId, tenantPrisma);
  }

  // Criação/edição/remoção de unidades: SINDICO tem as mesmas ações da
  // ADMINISTRADORA dentro do próprio condomínio (o RolesGuard já restringe o
  // escopo ao condomínio do vínculo dele).
  @Post('condominios/:condominioId/unidades')
  @Roles('ADMINISTRADORA', 'SINDICO')
  criar(
    @Param('condominioId') condominioId: string,
    @Body() dto: CriarUnidadeDto,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    return this.unidadesService.criar(condominioId, dto, tenantPrisma);
  }

  @Patch('unidades/:unidadeId')
  @Roles('ADMINISTRADORA', 'SINDICO')
  atualizar(
    @Param('unidadeId') unidadeId: string,
    @Body() dto: AtualizarUnidadeDto,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    return this.unidadesService.atualizar(unidadeId, dto, tenantPrisma);
  }

  @Delete('unidades/:unidadeId')
  @Roles('ADMINISTRADORA', 'SINDICO')
  @HttpCode(204)
  remover(
    @Param('unidadeId') unidadeId: string,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    return this.unidadesService.remover(unidadeId, tenantPrisma);
  }

  // Dados complementares de uma unidade — só SINDICO e ADMINISTRADORA podem
  // ler/escrever (campos sensíveis: saúde, mobilidade). CLAUDE.md, regras.
  @Get('unidades/:unidadeId/dados')
  @Roles('ADMINISTRADORA', 'SINDICO')
  buscarDados(
    @Param('unidadeId') unidadeId: string,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    return this.dadosUnidadeService.buscar(unidadeId, tenantPrisma);
  }

  @Put('unidades/:unidadeId/dados')
  @Roles('ADMINISTRADORA', 'SINDICO')
  salvarDados(
    @Param('unidadeId') unidadeId: string,
    @Body() dto: SalvarDadosUnidadeDto,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    return this.dadosUnidadeService.salvar(unidadeId, dto, tenantPrisma);
  }
}
