import { Module } from '@nestjs/common';
import { AlertsModule } from './alerts/alerts.module';
import { CityEventsModule } from './city-events/city-events.module';
import { DbModule } from './db/db.module';
import { HealthModule } from './health/health.module';
import { MeasurementsModule } from './measurements/measurements.module';
import { SensorsModule } from './sensors/sensors.module';

@Module({
  imports: [DbModule, HealthModule, SensorsModule, MeasurementsModule, AlertsModule, CityEventsModule],
})
export class AppModule {}
