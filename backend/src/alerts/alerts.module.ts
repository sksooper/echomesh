import { Module } from '@nestjs/common';
import { CityEventsModule } from '../city-events/city-events.module';
import { SensorsModule } from '../sensors/sensors.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  imports: [SensorsModule, CityEventsModule], // alert zagląda do czujnika (lokalizacja) i do wydarzeń
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService], // MeasurementsModule użyje go do sprawdzania norm
})
export class AlertsModule {}
