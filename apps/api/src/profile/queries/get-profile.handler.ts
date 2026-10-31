import { UnauthorizedException } from '@nestjs/common';
import { QueryBus, QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { FindUserByIdQuery } from '../../users/queries/find-user-by-id.query.js';
import {
  toProfileResponse,
  type ProfileResponse,
} from '../profile-response.js';
import { GetProfileQuery } from './get-profile.query.js';

@QueryHandler(GetProfileQuery)
export class GetProfileHandler implements IQueryHandler<GetProfileQuery> {
  constructor(private readonly queryBus: QueryBus) {}

  // A valid token whose user no longer exists is treated as signed out.
  async execute({ userId }: GetProfileQuery): Promise<ProfileResponse> {
    const user = await this.queryBus.execute(new FindUserByIdQuery(userId));
    if (!user) {
      throw new UnauthorizedException();
    }
    return toProfileResponse(user);
  }
}
