import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantInterceptor } from './tenant.interceptor';

@Global()
@Module({
  providers: [PrismaService, TenantInterceptor],
  exports: [PrismaService, TenantInterceptor],
})
export class PrismaModule {}
