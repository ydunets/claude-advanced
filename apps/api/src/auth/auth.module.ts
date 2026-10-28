import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthTokenService } from './auth-token.service.js';
import { RegisterHandler } from './commands/register.handler.js';
import { LoginHandler } from './queries/login.handler.js';

function getTokenLifetimeSeconds(config: ConfigService): number {
  const rawLifetime = config.getOrThrow<string>('JWT_EXPIRES_IN_SECONDS');
  const lifetimeSeconds = Number(rawLifetime);
  if (!Number.isInteger(lifetimeSeconds) || lifetimeSeconds <= 0) {
    throw new Error(
      `JWT_EXPIRES_IN_SECONDS must be a positive integer, got "${rawLifetime}"`,
    );
  }
  return lifetimeSeconds;
}

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: getTokenLifetimeSeconds(config) },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthTokenService, RegisterHandler, LoginHandler],
  exports: [AuthTokenService],
})
export class AuthModule {}
