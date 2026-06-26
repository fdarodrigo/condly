import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/rbac/roles.guard';
import { Roles } from '../auth/rbac/roles.decorator';
import { TenantInterceptor } from '../prisma/tenant.interceptor';
import { CurrentTenantPrisma } from '../common/current-tenant-prisma.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { DocumentosService } from './documentos.service';
import { CriarUploadUrlDto } from './dto/criar-upload-url.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Post('condominios/:condominioId/documentos/upload-url')
  @Roles('ADMINISTRADORA', 'SINDICO')
  criarUrlUpload(
    @Param('condominioId') condominioId: string,
    @Body() dto: CriarUploadUrlDto,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.documentosService.criarUrlUpload(condominioId, dto, prisma);
  }

  @Get('condominios/:condominioId/documentos')
  @Roles('ADMINISTRADORA', 'SINDICO', 'CONDOMINO')
  listar(
    @Param('condominioId') condominioId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.documentosService.listar(condominioId, usuario, prisma);
  }

  @Get('documentos/:documentoId/download-url')
  @Roles('ADMINISTRADORA', 'SINDICO', 'CONDOMINO')
  obterUrlDownload(
    @Param('documentoId') documentoId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @CurrentTenantPrisma() prisma: TenantPrismaClient,
  ) {
    return this.documentosService.obterUrlDownload(documentoId, usuario, prisma);
  }
}
