import { Module } from '@nestjs/common';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { FluxoReservaService } from './fluxos/fluxo-reserva.service';
import { FluxoChamadoService } from './fluxos/fluxo-chamado.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ReservasModule } from '../reservas/reservas.module';

@Module({
  imports: [WhatsappModule, ReservasModule],
  controllers: [BotController],
  providers: [BotService, FluxoReservaService, FluxoChamadoService],
})
export class BotModule {}
