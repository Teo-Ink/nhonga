import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { ReferralsController } from './referrals.controller.js';
import { AccountService } from './account.service.js';
import { AuthService } from './auth.service.js';
import { SocialAuthService } from './social.service.js';
import { SocialAuthController } from './social.controller.js';

@Module({
  controllers: [AuthController, SocialAuthController, ReferralsController],
  providers: [AuthService, AccountService, SocialAuthService],
  exports: [AuthService],
})
export class AuthModule {}
