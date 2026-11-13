import { Body, Controller, Post } from '@nestjs/common';
import { CreateMeasurementDto } from './measurements.dto';
import { MeasurementsService } from './measurements.service';

@Controller('measurements')
export class MeasurementsController {
  constructor(private measurements: MeasurementsService) {}

  // Endpoint publiczny — wysyłają do niego skrypty symulatora (curl / PowerShell)
  @Post()
  create(@Body() dto: CreateMeasurementDto) {
    return this.measurements.create(dto);
  }
}
