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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/rbac/roles.guard';
import { Roles } from '../auth/rbac/roles.decorator';
import { TenantInterceptor } from '../prisma/tenant.interceptor';
import { CurrentTenantPrisma } from '../common/current-tenant-prisma.decorator';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { CondominiosService } from './condominios.service';
import { PermissoesSindicoService } from './permissoes-sindico.service';
import { AtualizarCondominioDto } from './dto/atualizar-condominio.dto';
import { AdicionarMembroDto } from './dto/adicionar-membro.dto';

@Controller('condominios')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class CondominiosController {
  constructor(
    private readonly condominiosService: CondominiosService,
    private readonly permissoesService: PermissoesSindicoService,
  ) {}

  @Get(':condominioId')
  @Roles('ADMINISTRADORA', 'SINDICO', 'CONDOMINO')
  async findOne(
    @Param('condominioId') condominioId: string,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    const cond = await prisma.condominio.findUnique({ where: { id: condominioId } });
    if (!cond) throw new NotFoundException('Condomínio não encontrado.');
    return {
      ...cond,
      permissoesSindico: this.permissoesService.obterPermissoes(cond.permissoesSindico),
    };
  }

  @Patch(':condominioId')
  @Roles('ADMINISTRADORA', 'SINDICO')
  atualizar(
    @Param('condominioId') condominioId: string,
    @Body() dto: AtualizarCondominioDto,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    // SINDICO edita os dados cadastrais do próprio condomínio, mas NUNCA as
    // próprias permissões — senão qualquer restrição imposta pela
    // administradora seria desbloqueável pelo próprio restrito. A checagem
    // de quem pode editar permissoesSindico fica no service, comparando com
    // a administradora DESTE condomínio (não basta ter algum vínculo
    // ADMINISTRADORA — um síndico daqui que administra OUTRA carteira não
    // pode se autodesbloquear).
    return this.condominiosService.atualizar(condominioId, dto, usuario, tenantPrisma);
  }

  @Delete(':condominioId')
  @Roles('ADMINISTRADORA')
  @HttpCode(204)
  remover(
    @Param('condominioId') condominioId: string,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    return this.condominiosService.remover(condominioId, tenantPrisma);
  }

  // Membros: SINDICO gerencia os membros do próprio condomínio com as mesmas
  // ações da ADMINISTRADORA — o RolesGuard restringe o escopo ao condomínio
  // do vínculo dele; a administradoraId do vínculo criado vem do próprio
  // Condominio (ver CondominiosService.adicionarMembro), não do autor.
  @Get(':condominioId/membros')
  @Roles('ADMINISTRADORA', 'SINDICO')
  listarMembros(
    @Param('condominioId') condominioId: string,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    return this.condominiosService.listarMembros(condominioId, tenantPrisma);
  }

  @Post(':condominioId/membros')
  @Roles('ADMINISTRADORA', 'SINDICO')
  adicionarMembro(
    @Param('condominioId') condominioId: string,
    @Body() dto: AdicionarMembroDto,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    return this.condominiosService.adicionarMembro(condominioId, dto, tenantPrisma);
  }

  @Delete(':condominioId/membros/:usuarioId')
  @Roles('ADMINISTRADORA', 'SINDICO')
  @HttpCode(204)
  removerMembro(
    @Param('condominioId') condominioId: string,
    @Param('usuarioId') usuarioId: string,
    @CurrentTenantPrisma() tenantPrisma: TenantPrismaClient,
  ) {
    return this.condominiosService.removerMembro(condominioId, usuarioId, tenantPrisma);
  }
}
