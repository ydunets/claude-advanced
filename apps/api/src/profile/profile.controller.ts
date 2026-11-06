import {
  Body,
  Controller,
  Get,
  ParseFilePipe,
  Patch,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedUser } from '../auth/auth-token.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { createFileSizeLimitInterceptor } from '../uploads/file-size-limit.interceptor.js';
import { getMaxAvatarSizeBytes } from './avatar-storage.js';
import { UpdateProfileCommand } from './commands/update-profile.command.js';
import { UploadAvatarCommand } from './commands/upload-avatar.command.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { ProfileResponse } from './profile-response.js';
import { GetProfileQuery } from './queries/get-profile.query.js';

const AVATAR_FIELD = 'avatar';
const AvatarSizeLimitInterceptor = createFileSizeLimitInterceptor(
  getMaxAvatarSizeBytes,
);

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  getProfile(@CurrentUser() user: AuthenticatedUser): Promise<ProfileResponse> {
    return this.queryBus.execute(new GetProfileQuery(user));
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

  @Put('avatar')
  @UseInterceptors(AvatarSizeLimitInterceptor, FileInterceptor(AVATAR_FIELD))
  uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(new ParseFilePipe()) file: Express.Multer.File,
  ): Promise<ProfileResponse> {
    return this.commandBus.execute(new UploadAvatarCommand(user, file));
  }
}
