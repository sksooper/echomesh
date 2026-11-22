import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import { User } from '../users/user.types';
import { CreateReportDto } from './chatbot.dto';
import { ChatbotService } from './chatbot.service';

@Controller('chat')
export class ChatbotController {
  constructor(private chatbot: ChatbotService) {}

  // Dostępne dla każdego zalogowanego (globalny AuthGuard); autorem zgłoszenia jest użytkownik z tokenu
  @Post('report')
  report(@CurrentUser() user: User, @Body() dto: CreateReportDto) {
    return this.chatbot.submit(user, dto);
  }
}
