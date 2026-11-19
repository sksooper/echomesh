import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ListEventsQuery } from './city-events.dto';
import { CityEventsService } from './city-events.service';

@Controller('city-events')
export class CityEventsController {
  constructor(private events: CityEventsService) {}

  // GET /city-events?scope=current|active|all
  @Get()
  list(@Query() query: ListEventsQuery) {
    return this.events.findAll(query);
  }

  @Get(':id')
  async one(@Param('id', ParseIntPipe) id: number) {
    const event = await this.events.findOne(id);
    if (!event) throw new NotFoundException(`Event ${id} not found`);
    return event;
  }
}
