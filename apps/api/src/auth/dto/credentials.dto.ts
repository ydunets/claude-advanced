import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export const MIN_PASSWORD_LENGTH = 8;

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

// No length rule here: tightening the registration policy later must not turn
// an existing user's wrong-password attempt into a validation error.
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
