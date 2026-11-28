import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  AuthUserOut,
  OtpRequest,
  OtpRequestOut,
  OtpVerify,
  SocialComplete,
  SocialProvidersOut,
  SocialSessionOut,
  SocialStartOut,
} from '@nhonga/shared';
import { Returns } from '../../common/returns.js';
import { ZodBody } from '../../common/zod-body.js';
import { bearer, toHttp } from './auth.controller.js';
import {
  AuthService,
  type AuthUser,
  type OtpRequestResult,
  type VerifyResult,
} from './auth.service.js';
import { SocialAuthService, isSocialProvider, type SocialStart } from './social.service.js';
import type { SocialProvider } from './social-providers.js';

function providerParam(raw: string): SocialProvider {
  if (!isSocialProvider(raw)) throw new NotFoundException();
  return raw;
}

/**
 * Sign in with Google or Facebook, and confirm a phone on an account that has
 * none (AUTH-10). The web BFF drives the browser redirect and keeps `state`,
 * `nonce` and `codeVerifier` in an httpOnly cookie between start and complete.
 */
@Controller('auth')
export class SocialAuthController {
  constructor(
    private readonly social: SocialAuthService,
    private readonly auth: AuthService,
  ) {}

  /** Which providers are configured, so the sign-in page shows only those. */
  @Returns(SocialProvidersOut)
  @Get('social/providers')
  providers(): { providers: SocialProvider[] } {
    return { providers: this.social.providers() };
  }

  @Returns(SocialStartOut)
  @Post('social/:provider/start')
  @HttpCode(200)
  start(@Param('provider') provider: string): SocialStart {
    try {
      return this.social.start(providerParam(provider));
    } catch (e) {
      throw toHttp(e);
    }
  }

  /** Finish a sign-in: returns a session, opening a new account if needed. */
  @Returns(SocialSessionOut)
  @Post('social/:provider/complete')
  @HttpCode(200)
  async complete(
    @Param('provider') provider: string,
    @Body(new ZodBody(SocialComplete)) body: SocialComplete,
  ): Promise<VerifyResult & { created: boolean }> {
    try {
      return await this.social.signIn(providerParam(provider), body);
    } catch (e) {
      throw toHttp(e);
    }
  }

  /** Attach a provider to the signed-in account. */
  @Returns(AuthUserOut)
  @Post('social/:provider/link')
  @HttpCode(200)
  async link(
    @Param('provider') provider: string,
    @Body(new ZodBody(SocialComplete)) body: SocialComplete,
    @Headers('authorization') authz?: string,
  ): Promise<AuthUser> {
    try {
      return await this.social.link(bearer(authz), providerParam(provider), body);
    } catch (e) {
      throw toHttp(e);
    }
  }

  @Returns(AuthUserOut)
  @Delete('social/:provider')
  @HttpCode(200)
  async unlink(
    @Param('provider') provider: string,
    @Headers('authorization') authz?: string,
  ): Promise<AuthUser> {
    try {
      return await this.social.unlink(bearer(authz), providerParam(provider));
    } catch (e) {
      throw toHttp(e);
    }
  }

  /** Send a code to a number the signed-in user wants on their account. */
  @Returns(OtpRequestOut)
  @Post('phone/request')
  @HttpCode(200)
  async phoneRequest(
    @Body(new ZodBody(OtpRequest)) body: { phone: string },
    @Headers('authorization') authz?: string,
  ): Promise<OtpRequestResult> {
    try {
      return await this.auth.requestPhoneLink(bearer(authz), body.phone.trim());
    } catch (e) {
      throw toHttp(e);
    }
  }

  @Returns(AuthUserOut)
  @Post('phone/verify')
  @HttpCode(200)
  async phoneVerify(
    @Body(new ZodBody(OtpVerify)) body: { challengeId: string; code: string },
    @Headers('authorization') authz?: string,
  ): Promise<AuthUser> {
    try {
      return await this.auth.verifyPhoneLink(bearer(authz), body.challengeId, body.code);
    } catch (e) {
      throw toHttp(e);
    }
  }
}
