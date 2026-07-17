import { Module } from '@nestjs/common';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';
import { AuthModule } from '../auth/auth.module';
import { CondominiosModule } from '../condominios/condominios.module';

@Module({
  imports: [AuthModule, CondominiosModule],
  controllers: [ReservasController],
  providers: [ReservasService],
  // Exportado pro BotModule: o fluxo de reserva do bot usa exatamente as
  // mesmas regras de negócio (disponibilidade/criação) da API.
  exports: [ReservasService],
})
export class ReservasModule {}
