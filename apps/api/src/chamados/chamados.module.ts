import { Module } from '@nestjs/common';
import { ChamadosController } from './chamados.controller';
import { ChamadosService } from './chamados.service';
import { AuthModule } from '../auth/auth.module';
import { CondominiosModule } from '../condominios/condominios.module';

@Module({
  imports: [AuthModule, CondominiosModule],
  controllers: [ChamadosController],
  providers: [ChamadosService],
})
export class ChamadosModule {}
