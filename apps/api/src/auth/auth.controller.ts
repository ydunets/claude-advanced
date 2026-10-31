import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { AuthToken } from './auth-token.service.js';
import { RegisterCommand } from './commands/register.command.js';
import { LoginDto, RegisterDto } from './dto/credentials.dto.js';
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
  login(@Body() body: LoginDto): Promise<AuthToken> {
    return this.queryBus.execute(new LoginQuery(body.email, body.password));
  }
}
