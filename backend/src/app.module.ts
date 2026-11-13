import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { HealthModule } from './health/health.module';
import { MeasurementsModule } from './measurements/measurements.module';
import { SensorsModule } from './sensors/sensors.module';

@Module({
  imports: [DbModule, HealthModule, SensorsModule, MeasurementsModule],
})
export class AppModule {}
