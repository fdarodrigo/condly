import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

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

  @Delete('reservas/:reservaId')
  @Roles('ADMINISTRADORA', 'SINDICO', 'CONDOMINO')
  cancelar(
    @Param('reservaId') reservaId: string,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.reservasService.cancelar(reservaId, prisma);
  }
}
