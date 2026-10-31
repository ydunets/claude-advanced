import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProfileController } from './profile.controller.js';
import { GetProfileHandler } from './queries/get-profile.handler.js';

@Module({
  imports: [AuthModule],
  controllers: [ProfileController],
  providers: [GetProfileHandler],
})
export class ProfileModule {}
