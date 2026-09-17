import { describe, expect, it } from 'vitest';
import { PaymentMappingError, toPaymentResponse, type PaymentRow } from './payment.mapper.js';

const base: PaymentRow = {
  id: '11111111-1111-4111-8111-111111111111',
  orderId: '22222222-2222-4222-8222-222222222222',
  provider: 'mpesa',
  status: 'awaiting_user',
  amountCents: 150_00,
  providerRef: 'MP-REF-9',
  failureCode: null,
  failureMessage: null,
  expiresAt: new Date('2026-09-17T12:00:00.000Z'),
};

describe('toPaymentResponse', () => {
  it('maps a pending payment to the contract shape', () => {
    const out = toPaymentResponse(base);
    expect(out).toEqual({
      id: base.id,
      orderId: base.orderId,
      provider: 'mpesa',
      status: 'awaiting_user',
      amountCents: 15000,
      providerRef: 'MP-REF-9',
      expiresAt: '2026-09-17T12:00:00.000Z',
      failure: null,
    });
  });

  it('omits maskedMsisdn — it requires the unbuilt KMS decrypt path', () => {
    expect(toPaymentResponse(base)).not.toHaveProperty('maskedMsisdn');
  });

  it('builds the failure object with retryability from the documented taxonomy', () => {
    const out = toPaymentResponse({
      ...base,
      status: 'failed',
      failureCode: 'insufficient_balance',
      failureMessage: 'Saldo insuficiente na sua conta M-Pesa.',
    });
    expect(out.failure).toEqual({
      code: 'insufficient_balance',
      message: 'Saldo insuficiente na sua conta M-Pesa.',
      retryable: true,
    });
  });

  it('marks unknown as NOT retryable — a debited buyer must never be told it failed', () => {
    const out = toPaymentResponse({ ...base, status: 'failed', failureCode: 'unknown' });
    expect(out.failure?.retryable).toBe(false);
    // Falls back to the safe taxonomy message when none was stored.
    expect(out.failure?.message).toContain('avisamos por SMS');
  });

  it('falls back to taxonomy copy when the stored message is null', () => {
    const out = toPaymentResponse({ ...base, status: 'failed', failureCode: 'wrong_pin' });
    expect(out.failure?.message).toBe('PIN incorrecto. Tente novamente.');
  });

  it('rejects an out-of-contract status rather than serving it', () => {
    expect(() => toPaymentResponse({ ...base, status: 'bogus' })).toThrow(PaymentMappingError);
  });

  it('rejects an out-of-contract provider', () => {
    expect(() => toPaymentResponse({ ...base, provider: 'paypal' })).toThrow(PaymentMappingError);
  });

  it('rejects an unknown failure code rather than guessing retryability', () => {
    expect(() => toPaymentResponse({ ...base, status: 'failed', failureCode: 'gremlins' })).toThrow(
      PaymentMappingError,
    );
  });
});
