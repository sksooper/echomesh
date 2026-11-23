import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

/** Parametry zapytania GET /alerts — w URL-u wszystko jest tekstem, więc @Type zamienia na liczby. */
export class ListAlertsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(168)
  hours?: number = 24; // zakres czasu: 1 h … 7 dni

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(200)
  minDb?: number; // pokaż alerty o poziomie >= minDb

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  sensorId?: number;

  @IsOptional() @IsIn(['measurement', 'report'])
  source?: 'measurement' | 'report'; // skąd alert: z czujnika czy ze zgłoszenia mieszkańca

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit?: number = 50;
}
