import { UnauthorizedException } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { UpdateUserNameCommand } from '../../users/commands/update-user-name.command.js';
import {
  toProfileResponse,
  type ProfileResponse,
} from '../profile-response.js';
import { UpdateProfileCommand } from './update-profile.command.js';

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileHandler implements ICommandHandler<UpdateProfileCommand> {
  constructor(private readonly commandBus: CommandBus) {}

  // A valid token whose user no longer exists is treated as signed out.
  async execute({
    userId,
    name,
  }: UpdateProfileCommand): Promise<ProfileResponse> {
    const user = await this.commandBus.execute(
      new UpdateUserNameCommand(userId, name),
    );
    if (!user) {
      throw new UnauthorizedException();
    }
    return toProfileResponse(user);
  }
}
