import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { User } from '../users/user.types';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200) // domyślnie POST zwraca 201 (utworzono) — logowanie niczego nie tworzy
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  // Na razie strażnik założony tylko na ten endpoint; w jednym z kolejnych kroków włączymy go globalnie
  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: User) {
    return user;
  }
}
