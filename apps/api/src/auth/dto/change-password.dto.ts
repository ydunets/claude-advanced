import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { MIN_PASSWORD_LENGTH } from './credentials.dto.js';

export class ChangePasswordDto {
  // No length rule, as on LoginDto: a stricter policy must not turn a wrong
  // current password into a validation error.
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  newPassword: string;
}
