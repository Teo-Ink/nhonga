import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import { appUser, userIdentity } from '../../db/schema/identity.js';
import {
  AuthError,
  AuthService,
  toAuthUser,
  type AuthUser,
  type VerifyResult,
} from './auth.service.js';
import {
  SOCIAL_PROVIDERS,
  SocialError,
  facebookAuthorizeUrl,
  facebookExchange,
  googleAuthorizeUrl,
  googleExchange,
  type ProviderConfig,
  type SocialFetch,
  type SocialProfile,
  type SocialProvider,
} from './social-providers.js';

export interface SocialStart {
  /** Where to send the browser. */
  readonly url: string;
  /** To keep in an httpOnly cookie and send back on completion. `state` is
   *  compared by the caller with the one the provider returns. */
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
}

export interface SocialComplete {
  readonly code: string;
  readonly nonce: string;
  readonly codeVerifier: string;
  readonly referralCode?: string | undefined;
}

const PLACEHOLDER = /^(definir|changeme|todo|xxx)/i;

/** A provider is on only with a real id and secret; the placeholder a new
 *  secret starts with (runbooks/segredos.md) leaves it off. */
export function providerConfigFromEnv(
  provider: SocialProvider,
  env: NodeJS.ProcessEnv = process.env,
): ProviderConfig | null {
  const [idKey, secretKey] =
    provider === 'google'
      ? ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
      : ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'];
  const clientId = (env[idKey] ?? '').trim();
  const clientSecret = (env[secretKey] ?? '').trim();
  const idOk =
    provider === 'google'
      ? clientId.endsWith('.apps.googleusercontent.com')
      : /^\d{6,}$/.test(clientId);
  if (!idOk || clientSecret.length < 16 || PLACEHOLDER.test(clientSecret)) return null;
  return { clientId, clientSecret };
}

export function isSocialProvider(v: string): v is SocialProvider {
  return (SOCIAL_PROVIDERS as readonly string[]).includes(v);
}

const random = (): string => randomBytes(32).toString('base64url');

/** Printable text only, one line, capped: the name is shown to other users. */
export function cleanName(name: string | null): string {
  const kept = Array.from(name ?? '', (ch) => {
    const c = ch.codePointAt(0) ?? 0;
    return c < 0x20 || c === 0x7f || ch === '<' || ch === '>' ? ' ' : ch;
  }).join('');
  return kept.replace(/\s+/g, ' ').trim().slice(0, 60) || 'Cliente';
}

@Injectable()
export class SocialAuthService {
  private readonly log = new Logger('SocialAuth');
  /** Replaced in tests. */
  fetchImpl: SocialFetch = (url, init) => fetch(url, init);
  env: NodeJS.ProcessEnv = process.env;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly auth: AuthService,
  ) {}

  /** The providers that are configured, for the sign-in page. */
  providers(): SocialProvider[] {
    return SOCIAL_PROVIDERS.filter((p) => providerConfigFromEnv(p, this.env) !== null);
  }

  private config(provider: SocialProvider): ProviderConfig {
    const cfg = providerConfigFromEnv(provider, this.env);
    if (!cfg) throw new AuthError('not_available', 'Esta forma de entrar não está disponível.');
    return cfg;
  }

  /** Always our own address: the provider only returns codes to an address
   *  registered with it, and it is never taken from the request. */
  redirectUri(provider: SocialProvider): string {
    const web = (this.env['PUBLIC_WEB_URL'] ?? '').replace(/\/+$/, '');
    return `${web}/api/auth/social/${provider}/callback`;
  }

  start(provider: SocialProvider): SocialStart {
    const cfg = this.config(provider);
    const input = {
      redirectUri: this.redirectUri(provider),
      state: random(),
      nonce: random(),
      codeVerifier: random(),
    };
    const url =
      provider === 'google' ? googleAuthorizeUrl(cfg, input) : facebookAuthorizeUrl(cfg, input);
    return { url, state: input.state, nonce: input.nonce, codeVerifier: input.codeVerifier };
  }

  private async profile(provider: SocialProvider, input: SocialComplete): Promise<SocialProfile> {
    const cfg = this.config(provider);
    const exchange = {
      code: input.code,
      redirectUri: this.redirectUri(provider),
      nonce: input.nonce,
      codeVerifier: input.codeVerifier,
    };
    try {
      return provider === 'google'
        ? await googleExchange(cfg, exchange, this.fetchImpl, Date.now())
        : await facebookExchange(cfg, exchange, this.fetchImpl);
    } catch (e) {
      if (e instanceof SocialError) {
        this.log.warn(`${provider} sign-in refused: ${e.reason} (${e.message})`);
        if (e.reason === 'provider_unavailable')
          throw new AuthError(
            'provider_unavailable',
            'Não foi possível falar com o serviço agora. Tente de novo ou entre com o número.',
          );
        throw new AuthError(
          'social_failed',
          'Não foi possível confirmar a sua conta. Tente de novo.',
        );
      }
      throw e;
    }
  }

  private async identityOwner(provider: SocialProvider, subject: string): Promise<string | null> {
    const rows = await this.db
      .select({ userId: userIdentity.userId })
      .from(userIdentity)
      .where(and(eq(userIdentity.provider, provider), eq(userIdentity.subject, subject)))
      .limit(1);
    return rows[0]?.userId ?? null;
  }

  /**
   * Sign in, or open a new account, with a provider.
   *
   * A provider account maps to exactly one Nhonga account, by the provider's
   * id for the person. An unknown provider account always opens a NEW Nhonga
   * account: it is never attached to an existing one because an e-mail
   * matches. Joining is done on purpose, from the account page (link()).
   */
  async signIn(
    provider: SocialProvider,
    input: SocialComplete,
  ): Promise<VerifyResult & { created: boolean }> {
    const profile = await this.profile(provider, input);
    let userId = await this.identityOwner(provider, profile.subject);
    let created = false;

    if (userId === null) {
      const id = randomUUID();
      await this.db.transaction(async (tx) => {
        await tx.insert(appUser).values({
          id,
          phoneE164: null,
          displayName: cleanName(profile.name),
          status: 'active',
        });
        await tx
          .insert(userIdentity)
          .values({
            id: randomUUID(),
            userId: id,
            provider,
            subject: profile.subject,
            email: profile.email,
          })
          .onConflictDoNothing();
      });
      // Two first sign-ins racing: the unique index kept one identity row.
      userId = (await this.identityOwner(provider, profile.subject))!;
      created = userId === id;
      if (!created) await this.db.delete(appUser).where(eq(appUser.id, id));
    }

    const user = await this.activeUser(userId);
    const session = await this.auth.issueSession(user);
    if (created && input.referralCode)
      await this.auth.attributeReferral(user.id, input.referralCode);
    return { ...session, created };
  }

  private async activeUser(userId: string): Promise<AuthUser> {
    const u = (await this.db.select().from(appUser).where(eq(appUser.id, userId)).limit(1))[0];
    if (!u || u.status !== 'active') {
      throw new AuthError(
        'not_allowed',
        'Esta conta está suspensa. Contacte o apoio da Nhonga se acha que é um engano.',
      );
    }
    const providers = await this.db
      .select({ provider: userIdentity.provider })
      .from(userIdentity)
      .where(eq(userIdentity.userId, userId));
    return toAuthUser(u, providers.map((p) => p.provider).sort());
  }

  /** Attach a provider account to the signed-in Nhonga account. */
  async link(
    rawToken: string | null,
    provider: SocialProvider,
    input: SocialComplete,
  ): Promise<AuthUser> {
    const userId = await this.auth.requireUserId(rawToken);
    const profile = await this.profile(provider, input);
    const inUse = () =>
      new AuthError(
        'identity_in_use',
        'Essa conta já está ligada a outra conta Nhonga. Entre com ela, ou use outra.',
      );
    const owner = await this.identityOwner(provider, profile.subject);
    if (owner !== null && owner !== userId) throw inUse();
    if (owner === null) {
      const mine = await this.db
        .select({ id: userIdentity.id })
        .from(userIdentity)
        .where(and(eq(userIdentity.userId, userId), eq(userIdentity.provider, provider)))
        .limit(1);
      if (mine[0]) {
        throw new AuthError(
          'already_linked',
          'Já tem uma conta deste serviço ligada. Desligue-a primeiro para ligar outra.',
        );
      }
      try {
        await this.db.insert(userIdentity).values({
          id: randomUUID(),
          userId,
          provider,
          subject: profile.subject,
          email: profile.email,
        });
      } catch (e) {
        if ((e as { code?: string }).code === '23505') throw inUse();
        throw e;
      }
    }
    return this.auth.me(rawToken);
  }

  /** Detach a provider. Refused when it is the only way left into the account. */
  async unlink(rawToken: string | null, provider: SocialProvider): Promise<AuthUser> {
    const me = await this.auth.me(rawToken);
    if (!me.providers.includes(provider)) return me;
    const otherWays =
      (me.phoneVerified ? 1 : 0) + me.providers.filter((p) => p !== provider).length;
    if (otherWays === 0) {
      throw new AuthError(
        'last_sign_in_method',
        'É a única forma de entrar nesta conta. Confirme primeiro um número de telefone.',
      );
    }
    await this.db
      .delete(userIdentity)
      .where(and(eq(userIdentity.userId, me.id), eq(userIdentity.provider, provider)));
    return this.auth.me(rawToken);
  }
}
