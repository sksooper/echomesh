import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { HealthModule } from './health/health.module';
import { SensorsModule } from './sensors/sensors.module';

@Module({
  imports: [DbModule, HealthModule, SensorsModule],
})
export class AppModule {}
