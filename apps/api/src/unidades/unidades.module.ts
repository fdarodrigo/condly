import { Module } from '@nestjs/common';
import { UnidadesController } from './unidades.controller';
import { UnidadesService } from './unidades.service';
import { DadosUnidadeService } from './dados-unidade.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UnidadesController],
  providers: [UnidadesService, DadosUnidadeService],
})
export class UnidadesModule {}
