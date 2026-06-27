import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AdministradorasModule } from './administradoras/administradoras.module';
import { CondominiosModule } from './condominios/condominios.module';
import { UnidadesModule } from './unidades/unidades.module';
import { FinanceiroModule } from './financeiro/financeiro.module';
import { ChamadosModule } from './chamados/chamados.module';
import { ReservasModule } from './reservas/reservas.module';
import { DocumentosModule } from './documentos/documentos.module';
import { AvisosModule } from './avisos/avisos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    AdministradorasModule,
    CondominiosModule,
    UnidadesModule,
    FinanceiroModule,
    ChamadosModule,
    ReservasModule,
    DocumentosModule,
    AvisosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
