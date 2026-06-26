import { Module } from '@nestjs/common';
import { UnidadesController } from './unidades.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UnidadesController],
})
export class UnidadesModule {}
