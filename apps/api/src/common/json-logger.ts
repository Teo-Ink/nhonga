import type { LoggerService } from '@nestjs/common';
import { currentRequestId } from './request-context.js';
import { reportError } from './error-reporter.js';

type Level = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'VERBOSE';
const RANK: Record<Level, number> = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3, VERBOSE: 4 };

/**
 * One JSON object per line (P1-08): CloudWatch Logs Insights can filter and
 * count by any field, and the request id ties lines together. Levels are
 * upper case so the existing "?ERROR" metric filter keeps matching.
 */
export class JsonLogger implements LoggerService {
  private readonly max: number;

  constructor(
    level: string = process.env['LOG_LEVEL'] ?? 'info',
    private readonly write: (line: string) => void = (l) => process.stdout.write(l),
  ) {
    const key = level.toUpperCase() === 'LOG' ? 'INFO' : (level.toUpperCase() as Level);
    this.max = RANK[key] ?? RANK.INFO;
  }

  log(message: unknown, ...rest: unknown[]): void {
    this.emit('INFO', message, rest);
  }
  error(message: unknown, ...rest: unknown[]): void {
    this.emit('ERROR', message, rest);
  }
  warn(message: unknown, ...rest: unknown[]): void {
    this.emit('WARN', message, rest);
  }
  debug(message: unknown, ...rest: unknown[]): void {
    this.emit('DEBUG', message, rest);
  }
  verbose(message: unknown, ...rest: unknown[]): void {
    this.emit('VERBOSE', message, rest);
  }

  private emit(level: Level, message: unknown, rest: unknown[]): void {
    if (RANK[level] > this.max) return;
    // Nest passes (message, context) or, for errors, (message, stack, context).
    const context = typeof rest[rest.length - 1] === 'string' ? (rest.pop() as string) : undefined;
    const stack = level === 'ERROR' && typeof rest[0] === 'string' ? rest[0] : undefined;
    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      ...(context ? { context } : {}),
      msg: message instanceof Error ? message.message : String(message),
    };
    const requestId = currentRequestId();
    if (requestId) entry['requestId'] = requestId;
    if (stack) entry['stack'] = stack;
    this.write(`${JSON.stringify(entry)}\n`);
    if (level === 'ERROR') reportError(message, { context, requestId, stack });
  }
}
