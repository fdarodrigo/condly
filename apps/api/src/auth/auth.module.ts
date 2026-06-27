import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './rbac/roles.guard';
import { TenantScopeResolverService } from './rbac/tenant-scope-resolver.service';
import { VinculoAmploService } from './rbac/vinculo-amplo.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '1h') as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    TenantScopeResolverService,
    VinculoAmploService,
  ],
  exports: [JwtAuthGuard, RolesGuard, TenantScopeResolverService, VinculoAmploService],
})
export class AuthModule {}
