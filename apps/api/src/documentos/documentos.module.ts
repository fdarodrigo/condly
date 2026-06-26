import { Module } from '@nestjs/common';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { R2_CLIENT } from './storage/r2-client.interface';
import { R2S3Client } from './storage/r2-s3-client';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DocumentosController],
  providers: [DocumentosService, { provide: R2_CLIENT, useClass: R2S3Client }],
})
export class DocumentosModule {}
