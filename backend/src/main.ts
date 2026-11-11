import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // frontend (inny port) może wołać API
  await app.listen(3000, '0.0.0.0'); // 0.0.0.0 — inaczej kontener nie przyjmie połączeń z zewnątrz
}
bootstrap();
