import { Controller, Get, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { AuthenticatedUser } from '../auth/auth-token.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { ProfileResponse } from './profile-response.js';
import { GetProfileQuery } from './queries/get-profile.query.js';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  getProfile(@CurrentUser() user: AuthenticatedUser): Promise<ProfileResponse> {
    return this.queryBus.execute(new GetProfileQuery(user.id));
  }
}
