import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { seconds, ThrottlerModule } from '@nestjs/throttler';
import { getPositiveIntegerConfig } from '../config/positive-integer-config.js';
import { getAuthAttemptTracker } from './auth-attempt-tracker.js';
import { AuthController } from './auth.controller.js';
import { AuthTokenService } from './auth-token.service.js';
import { ChangePasswordHandler } from './commands/change-password.handler.js';
import { RegisterHandler } from './commands/register.handler.js';
import { LoginHandler } from './queries/login.handler.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: getPositiveIntegerConfig(config, 'JWT_EXPIRES_IN_SECONDS'),
        },
      }),
    }),
    // ponytail: in-memory counters, per API process; a shared store such as
    // Redis is needed once the API runs as more than one instance.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const windowSeconds = getPositiveIntegerConfig(
          config,
          'AUTH_ATTEMPT_WINDOW_SECONDS',
        );
        return {
          throttlers: [
            {
              limit: getPositiveIntegerConfig(config, 'AUTH_ATTEMPT_LIMIT'),
              ttl: seconds(windowSeconds),
              getTracker: getAuthAttemptTracker,
            },
          ],
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthTokenService,
    RegisterHandler,
    ChangePasswordHandler,
    LoginHandler,
  ],
  exports: [AuthTokenService],
})
export class AuthModule {}
