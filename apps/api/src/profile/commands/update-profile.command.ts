import { Command } from '@nestjs/cqrs';
import type { ProfileResponse } from '../profile-response.js';

export class UpdateProfileCommand extends Command<ProfileResponse> {
  constructor(
    readonly userId: string,
    readonly name: string,
  ) {
    super();
  }
}
