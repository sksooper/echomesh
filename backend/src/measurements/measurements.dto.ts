import { IsInt, IsNumber, Max, Min } from 'class-validator';

/** Pakiet telemetryczny wysyłany przez symulator: { "sensorId": 1, "dbLevel": 72.5 } */
export class CreateMeasurementDto {
  @IsInt()
  @Min(1)
  sensorId: number;

  @IsNumber()
  @Min(0)
  @Max(200) // to samo ograniczenie ma kolumna db_level w bazie (CHECK)
  dbLevel: number;
}
