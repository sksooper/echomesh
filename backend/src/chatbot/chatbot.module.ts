import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { CityEventsModule } from '../city-events/city-events.module';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { LlmService } from './llm.service';

@Module({
  // weryfikacja korzysta z harmonogramu wydarzeń, a zatwierdzenie zgłoszenia tworzy alert
  imports: [CityEventsModule, AlertsModule],
  controllers: [ChatbotController],
  providers: [ChatbotService, LlmService],
})
export class ChatbotModule {}
