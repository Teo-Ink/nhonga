import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { ReferralsController } from './referrals.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  controllers: [AuthController, ReferralsController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
