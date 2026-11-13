import { Body, Controller, DefaultValuePipe, Get, ParseIntPipe, Post, Query } from '@nestjs/common';
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

  // GET /measurements?sensorId=1&hours=24 — dane pod wykres czujnika
  @Get()
  history(
    @Query('sensorId', ParseIntPipe) sensorId: number,
    @Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours: number,
  ) {
    const clamped = Math.min(Math.max(hours, 1), 168); // 1 h … 7 dni
    return this.measurements.history(sensorId, clamped);
  }
}
