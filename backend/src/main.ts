import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // frontend (inny port) może wołać API
  // Globalna walidacja DTO: whitelist usuwa nieznane pola, transform tworzy instancje klas DTO
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(3000, '0.0.0.0'); // 0.0.0.0 — inaczej kontener nie przyjmie połączeń z zewnątrz
}
bootstrap();
