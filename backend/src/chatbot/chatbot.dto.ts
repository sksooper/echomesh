import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateReportDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @MinLength(3) @MaxLength(1000)
  message: string;

  /** Miejsce zgłoszenia wskazane na mapie. */
  @IsNumber() @Min(-90) @Max(90)
  lat: number;

  @IsNumber() @Min(-180) @Max(180)
  lng: number;
}

/** GET /chat/reports — kolejka moderacji (domyślnie czekające na decyzję). */
export class ListReportsQuery {
  @IsOptional() @IsIn(['pending', 'approved', 'rejected', 'all'])
  review?: 'pending' | 'approved' | 'rejected' | 'all' = 'pending';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit?: number = 50;
}

/** PATCH /chat/reports/:id/review */
export class ReviewReportDto {
  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';
}
