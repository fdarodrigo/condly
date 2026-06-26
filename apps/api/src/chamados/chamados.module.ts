import { Module } from '@nestjs/common';
import { ChamadosController } from './chamados.controller';
import { ChamadosService } from './chamados.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ChamadosController],
  providers: [ChamadosService],
})
export class ChamadosModule {}
