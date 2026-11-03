import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { AuthenticatedUser } from '../auth/auth-token.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { UpdateProfileCommand } from './commands/update-profile.command.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { ProfileResponse } from './profile-response.js';
import { GetProfileQuery } from './queries/get-profile.query.js';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  getProfile(@CurrentUser() user: AuthenticatedUser): Promise<ProfileResponse> {
    return this.queryBus.execute(new GetProfileQuery(user.id));
  }

  @Patch()
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateProfileDto,
  ): Promise<ProfileResponse> {
    return this.commandBus.execute(
      new UpdateProfileCommand(user.id, body.name),
    );
  }
}
