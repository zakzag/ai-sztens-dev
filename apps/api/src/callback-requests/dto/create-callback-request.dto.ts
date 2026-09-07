import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Validated body of POST /api/callback-requests. */
export class CreateCallbackRequestDto {
  @IsString()
  @MinLength(1, { message: 'A név megadása kötelező' })
  @MaxLength(120)
  name!: string;

  @IsEmail({}, { message: 'Érvényes e-mail címet adj meg' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @Matches(/^[+]?[0-9\s\-()]{6,20}$/, { message: 'Érvényes telefonszámot adj meg' })
  phone!: string;

  @IsString()
  @MinLength(10, { message: 'Kérjük, írj legalább 10 karaktert' })
  @MaxLength(1000)
  reason!: string;
}
