import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/rbac/roles.guard';
import { Roles } from '../auth/rbac/roles.decorator';
import { TenantInterceptor } from '../prisma/tenant.interceptor';
import { CurrentTenantPrisma } from '../common/current-tenant-prisma.decorator';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { FinanceiroService } from './financeiro.service';
import { CriarCobrancaDto } from './dto/criar-cobranca.dto';

@Controller('condominios/:condominioId')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class FinanceiroController {
  constructor(private readonly financeiroService: FinanceiroService) {}

  @Post('cobrancas')
  @Roles('ADMINISTRADORA', 'SINDICO')
  criarCobranca(
    @Param('condominioId') condominioId: string,
    @Body() dto: CriarCobrancaDto,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.financeiroService.criarCobranca(condominioId, dto, prisma);
  }

  @Get('financeiro/resumo')
  @Roles('ADMINISTRADORA', 'SINDICO')
  obterResumo(
    @Param('condominioId') condominioId: string,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.financeiroService.obterResumo(condominioId, prisma);
  }
}
