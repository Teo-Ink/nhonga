import { describe, expect, it } from 'vitest';
import { creditFor } from './checkout.credit.js';

describe('creditFor', () => {
  it('credits a top-up 1:1', () => {
    expect(
      creditFor({ purpose: 'wallet_topup', amountCents: 50_000, method: 'mpesa', payload: {} }),
    ).toEqual({
      kind: 'topup',
      balanceCents: 50_000,
      points: 0,
      description: 'Carregamento M-Pesa',
    });
  });

  it('credits a package with its bonus balance and points', () => {
    expect(
      creditFor({
        purpose: 'wallet_package',
        amountCents: 50_000,
        method: 'emola',
        payload: { packageId: 'popular' },
      }),
    ).toEqual({
      kind: 'purchase',
      balanceCents: 55_000,
      points: 60,
      description: 'Pacote Popular (e-Mola)',
    });
  });

  it('returns null for an unknown package or purpose (sent to review)', () => {
    expect(
      creditFor({
        purpose: 'wallet_package',
        amountCents: 1,
        method: 'mpesa',
        payload: { packageId: 'x' },
      }),
    ).toBeNull();
    expect(
      creditFor({ purpose: 'other', amountCents: 1, method: 'mpesa', payload: {} }),
    ).toBeNull();
  });
});
