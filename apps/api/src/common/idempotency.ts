import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import type { Db } from '../db/types.js';

/**
 * Idempotency-Key (P2-11) on the endpoints that move money or spend points.
 *
 * The client sends `Idempotency-Key: <uuid>` once per intended action and the
 * same key on every retry. The first request runs; a repeat with the same body
 * gets the first answer again (`Idempotent-Replayed: true`), a repeat while the
 * first is still running gets 409, and the same key with a different body gets
 * 422. The key is scoped to the caller (session, else IP) and the route, so
 * one person's key can never replay another person's answer.
 *
 * The header is optional so older clients keep working; the web BFF and the
 * app send it. Server errors (5xx) are not stored, so they can be retried.
 */
export const IDEMPOTENT_ROUTES: readonly RegExp[] = [
  /^\/(v1\/)?checkout\/(topup|package)\/?$/,
  /^\/(v1\/)?wallet\/(topup|purchase|boost|pro)\/?$/,
  /^\/(v1\/)?promotions\/?$/,
  /^\/(v1\/)?subscriptions\/?$/,
  /^\/(v1\/)?ads\/?$/,
];

const KEY = /^[A-Za-z0-9_-]{8,128}$/;
const TTL = sql`interval '24 hours'`;

export interface IdemStore {
  /** Claims the key; returns null when claimed now, or the existing record. */
  claim(keyHash: string, requestHash: string): Promise<IdemRecord | null>;
  complete(keyHash: string, status: number, body: string, type: string | null): Promise<void>;
  release(keyHash: string): Promise<void>;
}
export interface IdemRecord {
  requestHash: string;
  status: number | null;
  body: string | null;
  type: string | null;
}

export function postgresIdemStore(db: Db): IdemStore {
  return {
    async claim(keyHash, requestHash) {
      // Expired records free their key.
      await db.execute(
        sql`delete from idempotency_record where key_hash = ${keyHash} and created_at < now() - ${TTL}`,
      );
      const inserted = (await db.execute(sql`
        insert into idempotency_record (key_hash, request_hash) values (${keyHash}, ${requestHash})
        on conflict (key_hash) do nothing returning key_hash`)) as unknown as unknown[];
      if (inserted.length > 0) return null;
      const rows = (await db.execute(sql`
        select request_hash, status_code, response_body, content_type
        from idempotency_record where key_hash = ${keyHash}`)) as unknown as Array<{
        request_hash: string;
        status_code: number | null;
        response_body: string | null;
        content_type: string | null;
      }>;
      const r = rows[0];
      return r
        ? {
            requestHash: r.request_hash,
            status: r.status_code,
            body: r.response_body,
            type: r.content_type,
          }
        : null;
    },
    async complete(keyHash, status, body, type) {
      await db.execute(sql`
        update idempotency_record
        set status_code = ${status}, response_body = ${body}, content_type = ${type}, completed_at = now()
        where key_hash = ${keyHash}`);
    },
    async release(keyHash) {
      await db.execute(sql`delete from idempotency_record where key_hash = ${keyHash}`);
    },
  };
}

const sha = (s: string) => createHash('sha256').update(s).digest('base64url');

export function idempotencyMiddleware(store: IdemStore, routes = IDEMPOTENT_ROUTES) {
  const log = new Logger('Idempotency');
  return (req: Request, res: Response, next: NextFunction): void => {
    const path = req.path ?? '';
    if (req.method !== 'POST' || !routes.some((r) => r.test(path))) return next();
    const key = req.headers['idempotency-key'];
    if (key === undefined) return next();
    if (typeof key !== 'string' || !KEY.test(key)) {
      problem(
        res,
        400,
        'Idempotency-Key inválida (8 a 128 letras, números, - ou _).',
        'invalid_idempotency_key',
      );
      return;
    }
    const authz = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
    const caller = authz ? `s:${sha(authz)}` : `ip:${req.ip ?? ''}`;
    const keyHash = sha(`${caller}|${req.method}|${path}|${key}`);
    const requestHash = sha(JSON.stringify(req.body ?? null));

    store
      .claim(keyHash, requestHash)
      .then((existing) => {
        if (existing) {
          if (existing.requestHash !== requestHash) {
            return problem(
              res,
              422,
              'Esta Idempotency-Key já foi usada com outro pedido.',
              'idempotency_key_reused',
            );
          }
          if (existing.status === null) {
            res.setHeader('Retry-After', '2');
            return problem(
              res,
              409,
              'O mesmo pedido ainda está a ser processado.',
              'idempotency_in_progress',
            );
          }
          res.setHeader('Idempotent-Replayed', 'true');
          res.status(existing.status);
          if (existing.type) res.type(existing.type);
          res.send(existing.body ?? '');
          return;
        }
        // Capture what the handler sends, then store it once the response ends.
        const send = res.send.bind(res);
        let captured = '';
        res.send = ((body?: unknown) => {
          captured =
            typeof body === 'string'
              ? body
              : Buffer.isBuffer(body)
                ? body.toString()
                : JSON.stringify(body ?? '');
          return send(body as never);
        }) as Response['send'];
        res.on('finish', () => {
          const done =
            res.statusCode >= 500
              ? store.release(keyHash)
              : store.complete(
                  keyHash,
                  res.statusCode,
                  captured,
                  String(res.getHeader('content-type') ?? '') || null,
                );
          done.catch((e: unknown) => log.warn(`idempotency store failed: ${String(e)}`));
        });
        next();
      })
      .catch((e: unknown) => {
        // Never block a payment because the record could not be written.
        log.warn(`idempotency unavailable: ${String(e)}`);
        next();
      });
  };
}

function problem(res: Response, status: number, detail: string, code: string): void {
  res
    .status(status)
    .type('application/problem+json')
    .json({
      type: 'about:blank',
      title: status === 409 ? 'Conflict' : 'Unprocessable',
      status,
      detail,
      code,
    });
}
