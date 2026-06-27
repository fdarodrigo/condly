// Precisa ser o primeiro import do arquivo: módulos como AuthModule
// (JwtModule.register({ secret: process.env.JWT_SECRET })) leem
// process.env de forma síncrona/eager na avaliação do decorator
// @Module(), durante o próprio require() — antes de ConfigModule.forRoot()
// (que só roda já dentro do ciclo de instanciação do Nest, tarde demais
// pra esse caso específico) ter qualquer chance de carregar o .env. Mesmo
// padrão já usado em scripts/test-integration.js e prisma/seed.ts.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Adapter explícito (em vez de deixar o NestFactory auto-detectar via
  // require dinâmico de '@nestjs/platform-express') — nesta monorepo com
  // npm workspaces, @nestjs/core fica hoisted pra raiz mas
  // @nestjs/platform-express permanece só em apps/api/node_modules, e o
  // require dinâmico do auto-detect (a partir de onde @nestjs/core está)
  // nunca encontra esse pacote. Importar aqui resolve a partir deste
  // próprio arquivo (apps/api/src), onde o pacote está garantido.
  //
  // rawBody: true — necessário pro webhook do WhatsApp (src/bot) validar a
  // assinatura HMAC sobre os bytes exatos recebidos, antes do parse/validação
  // de JSON pelo ValidationPipe.
  const app = await NestFactory.create(AppModule, new ExpressAdapter(), { rawBody: true });
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
