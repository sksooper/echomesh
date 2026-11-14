import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { MeasurementsController } from './measurements.controller';
import { MeasurementsService } from './measurements.service';

@Module({
  imports: [AlertsModule], // dostęp do AlertsService (exports w AlertsModule)
  controllers: [MeasurementsController],
  providers: [MeasurementsService],
})
export class MeasurementsModule {}
