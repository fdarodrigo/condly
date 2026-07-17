import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CondominiosModule } from '../condominios/condominios.module';
import { AdvertenciasController } from './advertencias.controller';
import { AdvertenciasService } from './advertencias.service';

@Module({
  imports: [AuthModule, CondominiosModule],
  controllers: [AdvertenciasController],
  providers: [AdvertenciasService],
})
export class AdvertenciasModule {}
