import { Module } from '@nestjs/common';
import { CondominiosController } from './condominios.controller';
import { CondominiosService } from './condominios.service';
import { PermissoesSindicoService } from './permissoes-sindico.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CondominiosController],
  providers: [CondominiosService, PermissoesSindicoService],
  exports: [CondominiosService, PermissoesSindicoService],
})
export class CondominiosModule {}
