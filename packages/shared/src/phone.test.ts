import { describe, expect, it } from 'vitest';
import {
  formatAsTyped,
  formatInternational,
  formatNational,
  isValidMzMsisdn,
  maskMsisdn,
  normaliseMzMsisdn,
  operatorLabel,
  operatorOf,
  suggestedWalletFor,
} from './phone.js';

describe('normaliseMzMsisdn()', () => {
  it('accepts a bare national number', () => {
    expect(normaliseMzMsisdn('841234567')).toBe('+258841234567');
  });

  it('accepts the spaced format people actually type', () => {
    expect(normaliseMzMsisdn('84 123 4567')).toBe('+258841234567');
  });

  it('accepts full international with and without the plus', () => {
    expect(normaliseMzMsisdn('+258841234567')).toBe('+258841234567');
    expect(normaliseMzMsisdn('258841234567')).toBe('+258841234567');
  });

  it('accepts the 00 international prefix', () => {
    expect(normaliseMzMsisdn('00258841234567')).toBe('+258841234567');
  });

  it('tolerates dashes, dots, and parentheses', () => {
    expect(normaliseMzMsisdn('(84) 123-4567')).toBe('+258841234567');
    expect(normaliseMzMsisdn('+258.84.123.4567')).toBe('+258841234567');
  });

  it('accepts every live operator prefix', () => {
    for (const prefix of ['82', '83', '84', '85', '86', '87']) {
      expect(normaliseMzMsisdn(`${prefix}1234567`)).toBe(`+258${prefix}1234567`);
    }
  });

  it('rejects prefixes no mobile operator uses', () => {
    expect(normaliseMzMsisdn('881234567')).toBeNull();
    expect(normaliseMzMsisdn('811234567')).toBeNull();
  });

  it('rejects landlines and short codes', () => {
    expect(normaliseMzMsisdn('21123456')).toBeNull();
    expect(normaliseMzMsisdn('1234')).toBeNull();
  });

  it('rejects wrong-length numbers', () => {
    expect(normaliseMzMsisdn('8412345')).toBeNull();
    expect(normaliseMzMsisdn('8412345678')).toBeNull();
  });

  it('rejects empty and non-numeric input', () => {
    expect(normaliseMzMsisdn('')).toBeNull();
    expect(normaliseMzMsisdn('   ')).toBeNull();
    expect(normaliseMzMsisdn('abc')).toBeNull();
  });

  it('is idempotent', () => {
    const once = normaliseMzMsisdn('84 123 4567');
    expect(normaliseMzMsisdn(once as string)).toBe(once);
  });
});

describe('isValidMzMsisdn()', () => {
  it('agrees with normalisation', () => {
    expect(isValidMzMsisdn('841234567')).toBe(true);
    expect(isValidMzMsisdn('881234567')).toBe(false);
  });
});

describe('operatorOf()', () => {
  it('maps each prefix to its operator', () => {
    expect(operatorOf('+258821234567')).toBe('tmcel');
    expect(operatorOf('+258831234567')).toBe('tmcel');
    expect(operatorOf('+258841234567')).toBe('vodacom');
    expect(operatorOf('+258851234567')).toBe('vodacom');
    expect(operatorOf('+258861234567')).toBe('movitel');
    expect(operatorOf('+258871234567')).toBe('movitel');
  });

  it('returns null for an invalid number', () => {
    expect(operatorOf('881234567')).toBeNull();
  });
});

describe('suggestedWalletFor()', () => {
  it('pre-selects M-Pesa for Vodacom numbers', () => {
    expect(suggestedWalletFor('+258841234567')).toBe('mpesa');
    expect(suggestedWalletFor('+258851234567')).toBe('mpesa');
  });

  it('pre-selects e-Mola for Movitel numbers', () => {
    expect(suggestedWalletFor('+258861234567')).toBe('emola');
    expect(suggestedWalletFor('+258871234567')).toBe('emola');
  });

  it('pre-selects mKesh for Tmcel numbers', () => {
    expect(suggestedWalletFor('+258821234567')).toBe('mkesh');
  });

  it('returns null rather than guessing for an invalid number', () => {
    expect(suggestedWalletFor('not a number')).toBeNull();
  });
});

describe('operatorLabel()', () => {
  it('gives the name shown beside the phone field', () => {
    expect(operatorLabel('vodacom')).toBe('Vodacom');
    expect(operatorLabel('movitel')).toBe('Movitel');
    expect(operatorLabel('tmcel')).toBe('Tmcel');
  });
});

describe('display formatting', () => {
  it('formats nationally', () => {
    expect(formatNational('+258841234567')).toBe('84 123 4567');
  });

  it('formats internationally', () => {
    expect(formatInternational('+258841234567')).toBe('+258 84 123 4567');
  });

  it('masks the middle but keeps prefix and last four', () => {
    expect(maskMsisdn('+258841234567')).toBe('84 *** 4567');
  });

  it('returns null for invalid input instead of rendering something misleading', () => {
    expect(formatNational('garbage')).toBeNull();
    expect(maskMsisdn('garbage')).toBeNull();
  });
});

describe('formatAsTyped()', () => {
  it('formats progressively as the user types', () => {
    expect(formatAsTyped('8')).toBe('8');
    expect(formatAsTyped('84')).toBe('84');
    expect(formatAsTyped('841')).toBe('84 1');
    expect(formatAsTyped('84123')).toBe('84 123');
    expect(formatAsTyped('841234')).toBe('84 123 4');
    expect(formatAsTyped('841234567')).toBe('84 123 4567');
  });

  it('caps at nine digits so the field cannot overflow', () => {
    expect(formatAsTyped('8412345671234')).toBe('84 123 4567');
  });

  it('strips characters the numeric keypad should not have produced', () => {
    expect(formatAsTyped('84abc123')).toBe('84 123');
  });
});
