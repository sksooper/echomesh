import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    // APP_GUARD rejestruje strażnika globalnie: działa na każdym endpoincie całej aplikacji
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
