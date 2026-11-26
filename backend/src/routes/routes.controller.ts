import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { WalkRouteDto } from './routes.dto';
import { RoutesService } from './routes.service';

@Controller('routes')
export class RoutesController {
  constructor(private routes: RoutesService) {}

  // Dostępne dla każdego zalogowanego. POST, bo przekazujemy dwa punkty w ciele żądania; nic nie jest tworzone, więc 200.
  @Post('walk')
  @HttpCode(200)
  walk(@Body() dto: WalkRouteDto) {
    return this.routes.walk(dto.from, dto.to);
  }
}
