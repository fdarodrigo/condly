import { Module } from '@nestjs/common';
import { AdministradorasController } from './administradoras.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AdministradorasController],
})
export class AdministradorasModule {}
