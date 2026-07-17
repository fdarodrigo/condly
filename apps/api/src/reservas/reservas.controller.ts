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
import { ReservasService } from './reservas.service';
import { CriarReservaDto } from './dto/criar-reserva.dto';
import { DisponibilidadeQueryDto } from './dto/disponibilidade-query.dto';
import { AtualizarRegrasDto } from './dto/atualizar-regras.dto';
import { PermissoesSindicoService } from '../condominios/permissoes-sindico.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class ReservasController {
  constructor(
    private readonly reservasService: ReservasService,
    private readonly permissoesService: PermissoesSindicoService,
  ) {}

  @Get('condominios/:condominioId/areas-comuns')
  @Roles('ADMINISTRADORA', 'SINDICO', 'CONDOMINO')
  listarAreasComuns(
    @Param('condominioId') condominioId: string,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.reservasService.listarAreasComuns(condominioId, prisma);
  }

  @Get('condominios/:condominioId/reservas')
  @Roles('ADMINISTRADORA', 'SINDICO', 'CONDOMINO')
  listarReservas(
    @Param('condominioId') condominioId: string,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.reservasService.listarReservas(condominioId, prisma);
  }

  @Get('areas-comuns/:areaComumId/disponibilidade')
  @Roles('ADMINISTRADORA', 'SINDICO', 'CONDOMINO')
  disponibilidade(
    @Param('areaComumId') areaComumId: string,
    @Query() query: DisponibilidadeQueryDto,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.reservasService.disponibilidade(areaComumId, query.data, prisma);
  }

  @Post('areas-comuns/:areaComumId/reservas')
  @Roles('ADMINISTRADORA', 'SINDICO', 'CONDOMINO')
  criar(
    @Param('areaComumId') areaComumId: string,
    @Body() dto: CriarReservaDto,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.reservasService.criar(areaComumId, dto, usuario, prisma);
  }

  @Patch('areas-comuns/:areaComumId/regras')
  @Roles('ADMINISTRADORA', 'SINDICO')
  @HttpCode(200)
  atualizarRegras(
    @Param('areaComumId') areaComumId: string,
    @Body() dto: AtualizarRegrasDto,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.reservasService.atualizarRegras(areaComumId, dto, prisma);
  }

  @Delete('reservas/:reservaId')
  @Roles('ADMINISTRADORA', 'SINDICO', 'CONDOMINO')
  async cancelar(
    @Param('reservaId') reservaId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    const condominioVinculo = usuario.vinculos.find((v) => v.condominioId && v.papel === 'SINDICO');
    if (condominioVinculo?.condominioId) {
      await this.permissoesService.verificar(condominioVinculo.condominioId, 'reservasCancelar');
    }
    return this.reservasService.cancelar(reservaId, prisma);
  }
}
