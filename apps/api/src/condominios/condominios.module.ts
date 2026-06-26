import { Module } from '@nestjs/common';
import { CondominiosController } from './condominios.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CondominiosController],
})
export class CondominiosModule {}
