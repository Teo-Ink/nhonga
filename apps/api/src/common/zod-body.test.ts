import { BadRequestException } from '@nestjs/common';
import { ListingInput, ListingReport, OtpVerify } from '@nhonga/shared';
import { describe, expect, it } from 'vitest';
import { ZodBody } from './zod-body.js';

function errorsOf(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(BadRequestException);
    return ((e as BadRequestException).getResponse() as { errors: unknown[] }).errors;
  }
  throw new Error('expected a 400');
}

describe('ZodBody (P2-01)', () => {
  it('accepts a valid body, coerces form numbers and drops unknown fields', () => {
    const out = new ZodBody(ListingInput).transform({
      title: '  Bicicleta  ',
      category: 'casa',
      priceCents: '850000',
      extra: 'ignored',
    });
    expect(out).toEqual({ title: 'Bicicleta', category: 'casa', priceCents: 850000 });
  });

  it('lists every problem with the field and a human message', () => {
    expect(errorsOf(() => new ZodBody(ListingInput).transform({ priceCents: -1 }))).toEqual([
      { field: 'title', message: 'obrigatório' },
      { field: 'category', message: 'obrigatório' },
      { field: 'priceCents', message: 'mínimo 0' },
    ]);
  });

  it('enforces enums and formats', () => {
    expect(errorsOf(() => new ZodBody(ListingReport).transform({ reason: 'x' }))[0]).toMatchObject({
      field: 'reason',
    });
    expect(
      errorsOf(() => new ZodBody(OtpVerify).transform({ challengeId: 'c', code: '12ab56' }))[0],
    ).toMatchObject({ field: 'code', message: 'o código tem 6 dígitos' });
  });

  it('treats a missing body as empty, not as a crash', () => {
    expect(errorsOf(() => new ZodBody(ListingReport).transform(undefined))).toHaveLength(1);
  });
});
