import { Module } from '@nestjs/common';
import { AlertsModule } from './alerts/alerts.module';
import { AuthModule } from './auth/auth.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { CityEventsModule } from './city-events/city-events.module';
import { DbModule } from './db/db.module';
import { HealthModule } from './health/health.module';
import { MeasurementsModule } from './measurements/measurements.module';
import { RoutesModule } from './routes/routes.module';
import { SensorsModule } from './sensors/sensors.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [DbModule, HealthModule, SensorsModule, MeasurementsModule, AlertsModule, CityEventsModule, UsersModule, AuthModule, ChatbotModule, RoutesModule],
})
export class AppModule {}
