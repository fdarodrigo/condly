import { Module } from '@nestjs/common';
import { AcoesAdministrativasController } from './acoes-administrativas.controller';
import { AcoesAdministrativasService } from './acoes-administrativas.service';
import { AvisosModule } from '../avisos/avisos.module';
import { AuthModule } from '../auth/auth.module';
import { CondominiosModule } from '../condominios/condominios.module';

@Module({
  imports: [AuthModule, AvisosModule, CondominiosModule],
  controllers: [AcoesAdministrativasController],
  providers: [AcoesAdministrativasService],
})
export class AcoesAdministrativasModule {}
