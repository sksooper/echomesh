import { Module } from '@nestjs/common';
import { CityEventsModule } from '../city-events/city-events.module';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';

@Module({
  imports: [CityEventsModule], // weryfikacja zgłoszeń korzysta z harmonogramu wydarzeń
  controllers: [ChatbotController],
  providers: [ChatbotService],
})
export class ChatbotModule {}
