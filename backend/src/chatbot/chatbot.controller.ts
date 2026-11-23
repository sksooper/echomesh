import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators';
import { User } from '../users/user.types';
import { CreateReportDto, ListReportsQuery, ReviewReportDto } from './chatbot.dto';
import { ChatbotService } from './chatbot.service';

@Controller('chat')
export class ChatbotController {
  constructor(private chatbot: ChatbotService) {}

  // Dostępne dla każdego zalogowanego (globalny AuthGuard); autorem zgłoszenia jest użytkownik z tokenu
  @Post('report')
  report(@CurrentUser() user: User, @Body() dto: CreateReportDto) {
    return this.chatbot.submit(user, dto);
  }

  // „Moje zgłoszenia”: użytkownik widzi tylko własne
  @Get('reports/mine')
  mine(@CurrentUser() user: User) {
    return this.chatbot.findMine(user.id);
  }

  // Kolejka moderacji: analityk i administrator (treść zgłoszeń jest prywatna)
  @Roles('analyst')
  @Get('reports')
  list(@Query() query: ListReportsQuery) {
    return this.chatbot.findForModeration(query);
  }

  // Decyzja moderatora; zatwierdzenie tworzy alert na mapie
  @Roles('analyst')
  @Patch('reports/:id/review')
  review(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number, @Body() dto: ReviewReportDto) {
    return this.chatbot.review(user, id, dto.decision);
  }
}
