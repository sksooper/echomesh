import { Controller, Get, Query } from '@nestjs/common';
import { ListAlertsQuery } from './alerts.dto';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private alerts: AlertsService) {}

  // GET /alerts?hours=24&minDb=75&sensorId=2&limit=50
  @Get()
  list(@Query() query: ListAlertsQuery) {
    return this.alerts.findAll(query);
  }
}
