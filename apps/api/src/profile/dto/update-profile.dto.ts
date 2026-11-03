import { IsUserName } from '../../auth/dto/user-name.js';

export class UpdateProfileDto {
  @IsUserName()
  name: string;
}
