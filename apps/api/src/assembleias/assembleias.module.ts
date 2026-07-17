import { Module } from '@nestjs/common';
import { AssembleiasController } from './assembleias.controller';
import { AssembleiasService } from './assembleias.service';
import { AuthModule } from '../auth/auth.module';
import { CondominiosModule } from '../condominios/condominios.module';

@Module({
  imports: [AuthModule, CondominiosModule],
  controllers: [AssembleiasController],
  providers: [AssembleiasService],
})
export class AssembleiasModule {}
