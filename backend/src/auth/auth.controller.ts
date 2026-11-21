import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { User } from '../users/user.types';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from './decorators';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200) // domyślnie POST zwraca 201 (utworzono) — logowanie niczego nie tworzy
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  // Bez @Public(): wymaga tokenu dzięki globalnemu AuthGuard
  @Get('me')
  me(@CurrentUser() user: User) {
    return user;
  }
}
