import { Command } from '@nestjs/cqrs';
import type { AuthenticatedUser } from '../../auth/auth-token.service.js';
import type { ProfileResponse } from '../profile-response.js';

export class UploadAvatarCommand extends Command<ProfileResponse> {
  constructor(
    readonly user: AuthenticatedUser,
    readonly file: Express.Multer.File,
  ) {
    super();
  }
}
