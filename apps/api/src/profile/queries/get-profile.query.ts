import { Query } from '@nestjs/cqrs';
import type { ProfileResponse } from '../profile-response.js';

export class GetProfileQuery extends Query<ProfileResponse> {
  constructor(readonly userId: string) {
    super();
  }
}
