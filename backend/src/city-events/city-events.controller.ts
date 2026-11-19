import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateCityEventDto, ListEventsQuery, UpdateCityEventDto } from './city-events.dto';
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

  // Zapis / edycja / usuwanie będą ograniczone do roli admin po dodaniu uwierzytelniania (JWT + role)
  @Post()
  create(@Body() dto: CreateCityEventDto) {
    return this.events.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCityEventDto) {
    return this.events.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204) // sukces bez treści odpowiedzi
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.events.remove(id);
  }
}
