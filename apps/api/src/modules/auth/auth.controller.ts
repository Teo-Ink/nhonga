import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AccountService } from './account.service.js';
import { AuthError, AuthService, type AuthUser } from './auth.service.js';
import { OtpRequest, OtpVerify } from '@nhonga/shared';
import { ZodBody } from '../../common/zod-body.js';

interface RequestBody {
  phone?: unknown;
}
interface VerifyBody {
  challengeId?: unknown;
  code?: unknown;
  referralCode?: unknown;
}

/** Phone-OTP authentication. The web BFF stores the session token in an httpOnly cookie. */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly account: AccountService,
  ) {}

  @Post('otp/request')
  @HttpCode(200)
  async request(
    @Body(new ZodBody(OtpRequest)) body: RequestBody,
  ): Promise<{ challengeId: string; expiresInSeconds: number; devCode?: string }> {
    if (typeof body.phone !== 'string' || body.phone.trim() === '') {
      throw new BadRequestException({ message: 'phone is required' });
    }
    try {
      return await this.auth.requestOtp(body.phone.trim());
    } catch (e) {
      throw toHttp(e);
    }
  }

  @Post('otp/verify')
  @HttpCode(200)
  async verify(
    @Body(new ZodBody(OtpVerify)) body: VerifyBody,
  ): Promise<{ sessionToken: string; expiresAt: string; user: AuthUser }> {
    if (typeof body.challengeId !== 'string' || typeof body.code !== 'string') {
      throw new BadRequestException({ message: 'challengeId and code are required' });
    }
    const referralCode = typeof body.referralCode === 'string' ? body.referralCode : undefined;
    try {
      return await this.auth.verifyOtp(body.challengeId, body.code, referralCode);
    } catch (e) {
      throw toHttp(e);
    }
  }

  @Get('me')
  async me(@Headers('authorization') authz?: string): Promise<AuthUser> {
    try {
      return await this.auth.me(bearer(authz));
    } catch (e) {
      throw toHttp(e);
    }
  }

  @Get('orders')
  async orders(@Headers('authorization') authz?: string): Promise<unknown> {
    try {
      return { orders: await this.auth.listOrders(bearer(authz)) };
    } catch (e) {
      throw toHttp(e);
    }
  }

  /** Delete my account (P0-06): immediate, every session ends. */
  @Delete('me')
  @HttpCode(200)
  async deleteMe(@Headers('authorization') authz?: string): Promise<{ ok: true }> {
    try {
      return await this.account.deleteAccount(bearer(authz));
    } catch (e) {
      throw toHttp(e);
    }
  }

  /** Download my data as JSON (P0-06). */
  @Get('me/export')
  async exportMe(@Headers('authorization') authz?: string): Promise<Record<string, unknown>> {
    try {
      return await this.account.exportData(bearer(authz));
    } catch (e) {
      throw toHttp(e);
    }
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Headers('authorization') authz?: string): Promise<{ ok: true }> {
    await this.auth.logout(bearer(authz));
    return { ok: true };
  }
}

function bearer(authz: string | undefined): string | null {
  if (!authz) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authz.trim());
  return m ? m[1]! : null;
}

function toHttp(e: unknown): HttpException {
  if (e instanceof AuthError) {
    const payload = { error: 'Auth', message: e.userMessage, code: e.code };
    if (e.code === 'unauthenticated') return new UnauthorizedException(payload);
    if (e.code === 'rate_limited') return new HttpException(payload, HttpStatus.TOO_MANY_REQUESTS);
    if (e.code === 'not_allowed') return new HttpException(payload, HttpStatus.FORBIDDEN);
    if (e.code === 'sms_unavailable') {
      return new HttpException(payload, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return new BadRequestException(payload);
  }
  return e instanceof HttpException
    ? e
    : new HttpException({ message: 'Auth error' }, HttpStatus.INTERNAL_SERVER_ERROR);
}
