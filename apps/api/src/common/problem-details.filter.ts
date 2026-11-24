import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { currentRequestId } from './request-context.js';

/**
 * Every error leaves the API as application/problem+json (RFC 7807), which is
 * the error shape the OpenAPI contract documents. Two rules hold regardless of
 * where the error came from:
 *   - a thrown HttpException keeps its status and message;
 *   - anything else becomes a 500 whose body says nothing internal. An
 *     unexpected error in a payments service must never echo a stack trace or a
 *     SQL fragment to the caller.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    // An id in the URL that is not a UUID makes Postgres refuse the query
    // (22P02). To the caller that is simply "no such thing", not a server
    // fault: answer 404 and keep it out of the error alarms (PRE-01).
    if (!(exception instanceof HttpException) && isMalformedId(exception)) {
      res.status(HttpStatus.NOT_FOUND).type('application/problem+json').json({
        type: 'about:blank',
        title: 'Not Found',
        status: HttpStatus.NOT_FOUND,
        instance: req.path,
      });
      return;
    }

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let title = 'Internal Server Error';
    let detail: string | undefined;
    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        title = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        title = typeof b['error'] === 'string' ? (b['error'] as string) : exception.name;
        detail = typeof b['message'] === 'string' ? (b['message'] as string) : undefined;
        // Preserve any structured fields (e.g. the readiness check map) without
        // clobbering the standard problem members.
        // Never let a domain field overwrite a reserved RFC 7807 member
        // (notably status, which must stay the numeric HTTP code).
        const {
          error: _e,
          message: _m,
          statusCode: _s,
          type: _t,
          title: _ti,
          detail: _d,
          instance: _in,
          status: _st,
          ...rest
        } = b;
        extra = rest;
      }
    } else {
      // Unexpected: log the real thing server-side, tell the client nothing.
      this.logger.error(
        `Unhandled ${req.method} ${req.path}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res
      .status(status)
      .type('application/problem+json')
      .json({
        type: 'about:blank',
        title,
        status,
        ...(detail ? { detail } : {}),
        instance: req.path,
        ...extra,
        // Quoted by support to find the exact log lines of a failure.
        ...(status >= 500 ? { requestId: currentRequestId() } : {}),
      });
  }
}

/** Postgres "invalid input syntax" (22P02), on the error or on its cause. */
export function isMalformedId(e: unknown): boolean {
  for (let cur: unknown = e, depth = 0; cur && depth < 4; depth++) {
    if (typeof cur !== 'object') return false;
    if ((cur as { code?: unknown }).code === '22P02') return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}
