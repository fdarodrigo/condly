import { Module } from '@nestjs/common';
import { AdministradorasController } from './administradoras.controller';
import { AuthModule } from '../auth/auth.module';
import { CondominiosModule } from '../condominios/condominios.module';

@Module({
  imports: [AuthModule, CondominiosModule],
  controllers: [AdministradorasController],
})
export class AdministradorasModule {}
