import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedUser, AuthToken } from './auth-token.service.js';
import { ChangePasswordCommand } from './commands/change-password.command.js';
import { RegisterCommand } from './commands/register.command.js';
import { CurrentUser } from './current-user.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto, RegisterDto } from './dto/credentials.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { LoginQuery } from './queries/login.query.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('register')
  register(@Body() body: RegisterDto): Promise<AuthToken> {
    return this.commandBus.execute(
      new RegisterCommand(body.email, body.password, body.name),
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  login(@Body() body: LoginDto): Promise<AuthToken> {
    return this.queryBus.execute(new LoginQuery(body.email, body.password));
  }

  @Post('password')
  @HttpCode(HttpStatus.OK)
  // JwtAuthGuard first: the throttler keys this route by request.user.
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ChangePasswordDto,
  ): Promise<AuthToken> {
    return this.commandBus.execute(
      new ChangePasswordCommand(
        user.id,
        user.tokenVersion,
        body.currentPassword,
        body.newPassword,
      ),
    );
  }
}
