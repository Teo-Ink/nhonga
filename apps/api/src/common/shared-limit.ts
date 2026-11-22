import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import type { Db } from '../db/types.js';

/**
 * Limits on abuse-prone writes that hold across every API instance (P0-04,
 * decision SEC-04 → option "Postgres").
 *
 * The general per-request limiter (rate-limit.ts) stays in memory: it is a
 * cheap first line, and with N tasks a client gets at most N× its budget.
 * The writes below are the ones where N× matters (spam, scam messages, paid AI
 * calls, brute force), so each hit is counted in one Postgres row per client
 * per window: one indexed upsert, only on these routes. Redis would be faster
 * but is another service to run and pay for; at today's volume Postgres is
 * enough, and this module is the single place to swap it.
 *
 * If the database cannot be reached the request goes through (fail-open):
 * the database being down already breaks the write itself.
 */

export interface SharedRule {
  readonly name: string;
  readonly method: string;
  readonly pattern: RegExp;
  readonly limit: number;
  readonly windowSeconds: number;
  /** 'ip' for routes used before sign-in. */
  readonly by: 'client' | 'ip';
}

export const SHARED_RULES: readonly SharedRule[] = [
  {
    name: 'publish',
    method: 'POST',
    pattern: /^\/catalog\/products\/?$/,
    limit: 20,
    windowSeconds: 3600,
    by: 'client',
  },
  {
    name: 'report',
    method: 'POST',
    pattern: /^\/catalog\/products\/[^/]+\/reports\/?$/,
    limit: 10,
    windowSeconds: 3600,
    by: 'client',
  },
  {
    name: 'message',
    method: 'POST',
    pattern: /^\/conversations(\/[^/]+\/messages)?\/?$/,
    limit: 60,
    windowSeconds: 3600,
    by: 'client',
  },
  {
    name: 'review',
    method: 'POST',
    pattern: /^\/vendors\/[^/]+\/reviews\/?$/,
    limit: 10,
    windowSeconds: 3600,
    by: 'client',
  },
  {
    name: 'assistant',
    method: 'POST',
    pattern: /^\/assistant\//,
    limit: 30,
    windowSeconds: 3600,
    by: 'client',
  },
  {
    name: 'alert',
    method: 'POST',
    pattern: /^\/saved-searches\/?$/,
    limit: 20,
    windowSeconds: 86_400,
    by: 'client',
  },
  {
    name: 'otp-verify',
    method: 'POST',
    pattern: /^\/auth\/otp\/verify\/?$/,
    limit: 30,
    windowSeconds: 3600,
    by: 'ip',
  },
  {
    name: 'block',
    method: 'POST',
    pattern: /^\/conversations\/[^/]+\/block\/?$/,
    limit: 30,
    windowSeconds: 3600,
    by: 'client',
  },
];

export function matchRule(method: string, path: string, rules = SHARED_RULES): SharedRule | null {
  return rules.find((r) => r.method === method && r.pattern.test(path)) ?? null;
}

export function clientKey(req: Pick<Request, 'headers' | 'ip'>, by: SharedRule['by']): string {
  const authz = req.headers.authorization;
  const token = typeof authz === 'string' && authz.startsWith('Bearer ') ? authz.slice(7) : '';
  if (by === 'client' && token) {
    return `s:${createHash('sha256').update(token).digest('base64url').slice(0, 22)}`;
  }
  return `ip:${req.ip ?? 'unknown'}`;
}

/** Counts a hit and returns the hits in the current window. */
export type HitCounter = (key: string, windowSeconds: number) => Promise<number>;

export function postgresCounter(db: Db): HitCounter {
  let calls = 0;
  return async (key, windowSeconds) => {
    const rows = (await db.execute(sql`
      insert into rate_limit_bucket (key, window_start, hits)
      values (${key}, to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds}), 1)
      on conflict (key, window_start) do update set hits = rate_limit_bucket.hits + 1
      returning hits`)) as unknown as Array<{ hits: number }>;
    // Now and then, drop windows older than a day.
    if (++calls % 500 === 0) {
      await db.execute(
        sql`delete from rate_limit_bucket where window_start < now() - interval '2 days'`,
      );
    }
    return Number(rows[0]?.hits ?? 0);
  };
}

/** SHARED_LIMIT_SCALE multiplies every limit (default 1). Only the end-to-end
 *  test stack raises it, because it signs in many times from one address. */
export function limitScale(raw = process.env['SHARED_LIMIT_SCALE']): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function sharedLimitMiddleware(count: HitCounter, rules = SHARED_RULES) {
  const log = new Logger('SharedLimit');
  const scale = limitScale();
  return (req: Request, res: Response, next: NextFunction): void => {
    const rule = matchRule(req.method, req.path ?? req.url ?? '', rules);
    if (rule === null) return next();
    const key = `${rule.name}:${clientKey(req, rule.by)}`;
    count(key, rule.windowSeconds)
      .then((hits) => {
        if (hits <= rule.limit * scale) return next();
        log.warn(`shared_limit rule=${rule.name}`);
        res.setHeader('Retry-After', String(rule.windowSeconds));
        res.status(429).type('application/problem+json').json({
          type: 'about:blank',
          title: 'Too Many Requests',
          status: 429,
          detail: 'Demasiados pedidos. Aguarde um pouco e tente de novo.',
          code: 'rate_limited',
        });
      })
      .catch((e: unknown) => {
        log.warn(`shared_limit unavailable: ${e instanceof Error ? e.message : String(e)}`);
        next();
      });
  };
}
