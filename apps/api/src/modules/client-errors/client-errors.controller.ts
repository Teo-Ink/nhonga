import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { ClientErrorReport } from '@nhonga/shared';
import { ZodBody } from '../../common/zod-body.js';

/** Reports per minute accepted from everyone together. Past this the reports
 *  are dropped: one bad release must not flood the log or the error tracker. */
const GLOBAL_PER_MINUTE = 120;

const SOURCE_NAME = {
  web: 'ClientWeb',
  'web-server': 'WebServer',
  mobile: 'ClientMobile',
} as const;

/** Removes what could identify a person from text written by a browser or an
 *  app: query strings, e-mail addresses and long digit runs (phones, codes). */
export function scrubText(text: string): string {
  return text
    .replace(/\?[^\s)'"]*/g, '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\+?\d[\d\s-]{6,}\d/g, '[number]');
}

/**
 * Crash reports from the site and the app (OPS-06).
 *
 * The site and the app send their unhandled errors here instead of talking to
 * the error tracker themselves: no third-party script in the page, no visitor
 * IP at the tracker, and one place that decides what is kept. Each report is
 * written as an ERROR line, which the logger forwards to the tracker under
 * the source's name.
 */
@Controller('client-errors')
export class ClientErrorsController {
  private readonly logs = {
    web: new Logger(SOURCE_NAME.web),
    'web-server': new Logger(SOURCE_NAME['web-server']),
    mobile: new Logger(SOURCE_NAME.mobile),
  };
  private windowStart = 0;
  private inWindow = 0;

  /** Replaced in tests. */
  now: () => number = Date.now;

  @Post()
  @HttpCode(202)
  report(@Body(new ZodBody(ClientErrorReport)) body: ClientErrorReport): { accepted: boolean } {
    const t = this.now();
    if (t - this.windowStart >= 60_000) {
      this.windowStart = t;
      this.inWindow = 0;
    }
    // Always 202: the sender can do nothing useful with a refusal.
    if (++this.inWindow > GLOBAL_PER_MINUTE) return { accepted: false };

    const where = [
      body.route ? `route=${scrubText(body.route)}` : null,
      body.release ? `release=${body.release}` : null,
      body.platform ? `platform=${body.platform}` : null,
    ]
      .filter(Boolean)
      .join(' ');
    const message = scrubText(body.message);
    const line = where ? `${message} [${where}]` : message;
    const log = this.logs[body.source];
    if (body.stack) log.error(line, scrubText(body.stack));
    else log.error(line);
    return { accepted: true };
  }
}
