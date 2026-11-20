import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

// Przed walidacją: usuwamy spacje i zamieniamy e-mail na małe litery, żeby "Jan@X.pl" i "jan@x.pl" było tym samym kontem
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100)
  name: string;

  @Transform(normalizeEmail) @IsEmail() @MaxLength(200)
  email: string;

  @IsString() @MinLength(8) @MaxLength(100)
  password: string;
}

export class LoginDto {
  @Transform(normalizeEmail) @IsEmail()
  email: string;

  @IsString() @IsNotEmpty()
  password: string;
}
