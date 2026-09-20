import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthError, AuthService, type AuthUser } from './auth.service.js';

interface RequestBody {
  phone?: unknown;
}
interface VerifyBody {
  challengeId?: unknown;
  code?: unknown;
}

/** Phone-OTP authentication. The web BFF stores the session token in an httpOnly cookie. */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  @HttpCode(200)
  async request(
    @Body() body: RequestBody,
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
    @Body() body: VerifyBody,
  ): Promise<{ sessionToken: string; expiresAt: string; user: AuthUser }> {
    if (typeof body.challengeId !== 'string' || typeof body.code !== 'string') {
      throw new BadRequestException({ message: 'challengeId and code are required' });
    }
    try {
      return await this.auth.verifyOtp(body.challengeId, body.code);
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
    return new BadRequestException(payload);
  }
  return e instanceof HttpException
    ? e
    : new HttpException({ message: 'Auth error' }, HttpStatus.INTERNAL_SERVER_ERROR);
}
