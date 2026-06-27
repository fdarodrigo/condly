import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      // Emite o evento 'query' (sem logar no console) pra permitir contar
      // queries SQL disparadas em teste — ver dashboard.integration-spec.ts.
      // Sem listener attached, não tem custo nenhum em produção.
      log: [{ emit: 'event', level: 'query' }],
    });
  }

  /**
   * `extends PrismaClient` (sem o generic `<'query'>`) perde a tipagem de
   * `$on('query', ...)` — o construct signature do client genérico resolve
   * o type argument contra `Options` da sobrecarga errada, não contra
   * `LogOpts`. Contorna isso num único lugar, em vez de espalhar
   * `as unknown` pelos call sites (ex: no teste do dashboard agregado).
   */
  onQuery(callback: (event: Prisma.QueryEvent) => void): void {
    (this as unknown as { $on(event: 'query', cb: (event: Prisma.QueryEvent) => void): void }).$on(
      'query',
      callback,
    );
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
