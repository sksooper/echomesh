import { Controller, Get, NotFoundException, Param, ParseIntPipe } from '@nestjs/common';
import { SensorsService } from './sensors.service';

@Controller('sensors')
export class SensorsController {
  constructor(private sensors: SensorsService) {}

  @Get()
  list() {
    return this.sensors.findAll();
  }

  // ParseIntPipe zamienia "3" na liczbę 3 i odrzuca np. "abc" kodem 400
  @Get(':id')
  async one(@Param('id', ParseIntPipe) id: number) {
    const sensor = await this.sensors.findOne(id);
    if (!sensor) throw new NotFoundException(`Sensor ${id} not found`);
    return sensor;
  }
}
