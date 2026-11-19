import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListEventsQuery {
  /** current = niezakończone (trwające + zaplanowane), active = tylko trwające, all = także zakończone */
  @IsOptional()
  @IsIn(['current', 'active', 'all'])
  scope?: 'current' | 'active' | 'all' = 'current';
}

/** Nowe wydarzenie: punkt na mapie (lat/lng) + czas trwania. Strefa ma stały promień (EVENT_RADIUS_M). */
export class CreateCityEventDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  title: string;

  @IsISO8601() // np. "2026-11-20T18:00:00Z"
  startTime: string;

  @IsISO8601()
  endTime: string;

  @IsNumber() @Min(-90) @Max(90)
  lat: number;

  @IsNumber() @Min(-180) @Max(180)
  lng: number;
}

/** Edycja: wszystkie pola opcjonalne (PATCH zmienia tylko to, co przysłano). */
export class UpdateCityEventDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200)
  title?: string;

  @IsOptional() @IsISO8601()
  startTime?: string;

  @IsOptional() @IsISO8601()
  endTime?: string;

  @IsOptional() @IsNumber() @Min(-90) @Max(90)
  lat?: number;

  @IsOptional() @IsNumber() @Min(-180) @Max(180)
  lng?: number;
}
