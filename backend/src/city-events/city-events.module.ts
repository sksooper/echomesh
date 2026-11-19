import { Module } from '@nestjs/common';
import { CityEventsController } from './city-events.controller';
import { CityEventsService } from './city-events.service';

@Module({
  controllers: [CityEventsController],
  providers: [CityEventsService],
  exports: [CityEventsService], // użyje go moduł alertów (a później chatbot)
})
export class CityEventsModule {}
