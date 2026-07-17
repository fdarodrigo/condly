import { Module } from '@nestjs/common';
import { EnquetesController } from './enquetes.controller';
import { EnquetesService } from './enquetes.service';
import { AvisosModule } from '../avisos/avisos.module';
import { AuthModule } from '../auth/auth.module';
import { CondominiosModule } from '../condominios/condominios.module';

@Module({
  imports: [AuthModule, AvisosModule, CondominiosModule],
  controllers: [EnquetesController],
  providers: [EnquetesService],
})
export class EnquetesModule {}
