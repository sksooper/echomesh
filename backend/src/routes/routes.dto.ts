import { Type } from 'class-transformer';
import { IsNumber, IsObject, Max, Min, ValidateNested } from 'class-validator';

export class PointDto {
  @IsNumber() @Min(-90) @Max(90)
  lat: number;

  @IsNumber() @Min(-180) @Max(180)
  lng: number;
}

/** POST /routes/walk: { "from": { "lat": 51.11, "lng": 17.03 }, "to": { "lat": 51.10, "lng": 17.07 } } */
export class WalkRouteDto {
  // @IsObject() jest konieczne: bez niego brakujące pole przechodzi walidację
  // (@ValidateNested pomija wartość undefined), a błąd wychodzi dopiero w serwisie jako 500.
  // @ValidateNested + @Type walidują dodatkowo pola wewnątrz obiektów from / to.
  @IsObject() @ValidateNested() @Type(() => PointDto)
  from: PointDto;

  @IsObject() @ValidateNested() @Type(() => PointDto)
  to: PointDto;
}