import {
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthError, AuthService } from './auth.service.js';

function bearer(authz: string | undefined): string | null {
  if (!authz) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authz.trim());
  return m ? m[1]! : null;
}

/** Referral stats for the signed-in user (invite page). */
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly auth: AuthService) {}

  @Get('summary')
  async summary(@Headers('authorization') authz?: string): Promise<{
    code: string;
    friends: number;
    rewarded: number;
    pointsEarned: number;
  }> {
    try {
      return await this.auth.referralSummary(bearer(authz));
    } catch (e) {
      if (e instanceof AuthError && e.code === 'unauthenticated') {
        throw new UnauthorizedException({ message: e.userMessage });
      }
      throw e instanceof HttpException
        ? e
        : new HttpException({ message: 'Referral error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
