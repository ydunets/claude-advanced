import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import {
  toProfileResponse,
  type ProfileResponse,
} from '../profile-response.js';
import { GetProfileQuery } from './get-profile.query.js';

@QueryHandler(GetProfileQuery)
export class GetProfileHandler implements IQueryHandler<GetProfileQuery> {
  // JwtAuthGuard has already loaded the user, so reading it again would only
  // repeat the guard's SELECT.
  async execute({ user }: GetProfileQuery): Promise<ProfileResponse> {
    return toProfileResponse(user);
  }
}
