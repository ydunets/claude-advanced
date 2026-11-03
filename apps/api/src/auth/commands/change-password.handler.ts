import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CommandBus,
  CommandHandler,
  QueryBus,
  type ICommandHandler,
} from '@nestjs/cqrs';
import { UpdateUserPasswordCommand } from '../../users/commands/update-user-password.command.js';
import { FindUserByIdQuery } from '../../users/queries/find-user-by-id.query.js';
import { AuthTokenService, type AuthToken } from '../auth-token.service.js';
import { hashPassword, isPasswordMatching } from '../password.js';
import { ChangePasswordCommand } from './change-password.command.js';

const WRONG_CURRENT_PASSWORD_MESSAGE = 'Current password is incorrect';
const UNCHANGED_PASSWORD_MESSAGE =
  'New password must differ from the current one';
const CONCURRENT_CHANGE_MESSAGE = 'The password was changed by another request';

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<ChangePasswordCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly authTokenService: AuthTokenService,
  ) {}

  // A wrong current password answers 403, not 401, because clients treat 401
  // as signed out. A valid token whose user no longer exists is signed out.
  // A concurrent change that already moved the token's version answers 409,
  // not 401, so a double submit never signs out the browser that won.
  // The guard's user omits passwordHash, so this one read stays.
  async execute({
    userId,
    tokenVersion,
    currentPassword,
    newPassword,
  }: ChangePasswordCommand): Promise<AuthToken> {
    const user = await this.queryBus.execute(new FindUserByIdQuery(userId));
    if (!user) {
      throw new UnauthorizedException();
    }
    const isCurrentPasswordMatching = await isPasswordMatching(
      currentPassword,
      user.passwordHash,
    );
    if (!isCurrentPasswordMatching) {
      throw new ForbiddenException(WRONG_CURRENT_PASSWORD_MESSAGE);
    }
    if (newPassword === currentPassword) {
      throw new BadRequestException(UNCHANGED_PASSWORD_MESSAGE);
    }
    const passwordHash = await hashPassword(newPassword);
    const updatedUser = await this.commandBus.execute(
      new UpdateUserPasswordCommand(userId, passwordHash, tokenVersion),
    );
    if (!updatedUser) {
      throw new ConflictException(CONCURRENT_CHANGE_MESSAGE);
    }
    return this.authTokenService.createAuthToken(updatedUser);
  }
}
