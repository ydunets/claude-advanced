import { Query } from '@nestjs/cqrs';
import type { AuthenticatedUser } from '../../auth/auth-token.service.js';
import type { ProfileResponse } from '../profile-response.js';

export class GetProfileQuery extends Query<ProfileResponse> {
  constructor(readonly user: AuthenticatedUser) {
    super();
  }
}
