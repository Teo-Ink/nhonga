import { describe, expect, it } from 'vitest';
import {
  add,
  allocate,
  applyBasisPoints,
  cents,
  centsFromDb,
  formatMZN,
  fromMeticais,
  MoneyError,
  multiply,
  parseMZNToCents,
  subtract,
} from './money.js';

describe('cents()', () => {
  it('accepts whole numbers', () => {
    expect(cents(0)).toBe(0);
    expect(cents(125000)).toBe(125000);
    expect(cents(-500)).toBe(-500);
  });

  it('rejects fractional values — there is no half-centavo', () => {
    expect(() => cents(12.5)).toThrow(MoneyError);
    expect(() => cents(0.1 + 0.2)).toThrow(MoneyError);
  });

  it('rejects values beyond the permitted maximum', () => {
    expect(() => cents(2_000_000_000_000)).toThrow(MoneyError);
  });

  it('rejects NaN and Infinity', () => {
    expect(() => cents(Number.NaN)).toThrow(MoneyError);
    expect(() => cents(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
  });
});

describe('centsFromDb()', () => {
  it('parses the string a BIGINT column returns', () => {
    expect(centsFromDb('125000')).toBe(125000);
  });

  it('treats null and undefined as zero', () => {
    expect(centsFromDb(null)).toBe(0);
    expect(centsFromDb(undefined)).toBe(0);
  });

  it('throws on unparseable input rather than silently yielding NaN', () => {
    expect(() => centsFromDb('not-a-number')).toThrow(MoneyError);
  });
});

describe('arithmetic', () => {
  it('adds without floating-point drift', () => {
    // The classic 0.1 + 0.2 problem cannot occur: these are integers.
    const result = add(cents(10), cents(20));
    expect(result).toBe(30);
  });

  it('adds many amounts', () => {
    expect(add(cents(125000), cents(35000), cents(15000))).toBe(175000);
  });

  it('subtracts, including into negatives for refunds and adjustments', () => {
    expect(subtract(cents(125000), cents(150000))).toBe(-25000);
  });

  it('multiplies by a whole quantity', () => {
    expect(multiply(cents(35000), 3)).toBe(105000);
  });

  it('rejects fractional or negative quantities', () => {
    expect(() => multiply(cents(100), 1.5)).toThrow(MoneyError);
    expect(() => multiply(cents(100), -1)).toThrow(MoneyError);
  });

  it('converts meticais to centavos', () => {
    expect(fromMeticais(1250)).toBe(125000);
    expect(fromMeticais(12.5)).toBe(1250);
  });
});

describe('applyBasisPoints()', () => {
  it('computes a flat 8% commission', () => {
    // 1.950,00 MT at 800bps = 156,00 MT
    expect(applyBasisPoints(cents(195000), 800)).toBe(15600);
  });

  it('handles a fractional-percentage rate without floating-point error', () => {
    // 8.25% of 1.000,00 MT = 82,50 MT
    expect(applyBasisPoints(cents(100000), 825)).toBe(8250);
  });

  it('rounds half away from zero', () => {
    // 1% of 50 centavos = 0.5 → 1
    expect(applyBasisPoints(cents(50), 100)).toBe(1);
  });

  it('returns zero for a zero rate', () => {
    expect(applyBasisPoints(cents(195000), 0)).toBe(0);
  });

  it('rejects rates outside 0–10000bps', () => {
    expect(() => applyBasisPoints(cents(100), 10_001)).toThrow(MoneyError);
    expect(() => applyBasisPoints(cents(100), -1)).toThrow(MoneyError);
    expect(() => applyBasisPoints(cents(100), 8.5)).toThrow(MoneyError);
  });
});

describe('allocate()', () => {
  it('splits evenly when it divides cleanly', () => {
    expect(allocate(cents(30000), [1, 1, 1])).toEqual([10000, 10000, 10000]);
  });

  it('never loses a centavo to rounding', () => {
    // 100 centavos across 3 buckets: 34 + 33 + 33, not 33 + 33 + 33.
    const parts = allocate(cents(100), [1, 1, 1]);
    expect(parts).toEqual([34, 33, 33]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('allocates proportionally to weights', () => {
    // A 500,00 MT discount across lines of 1.950,00 and 850,00.
    const parts = allocate(cents(50000), [195000, 85000]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(50000);
    expect(parts[0]).toBeGreaterThan(parts[1] as number);
  });

  it('is deterministic — the same input always yields the same split', () => {
    const first = allocate(cents(1000), [7, 11, 13]);
    const second = allocate(cents(1000), [7, 11, 13]);
    expect(first).toEqual(second);
  });

  it('gives leftovers to the largest remainder, ties broken by position', () => {
    // 10 centavos across 4 equal buckets → 3,3,2,2
    expect(allocate(cents(10), [1, 1, 1, 1])).toEqual([3, 3, 2, 2]);
  });

  it('handles a zero total', () => {
    expect(allocate(cents(0), [1, 2, 3])).toEqual([0, 0, 0]);
  });

  it('tolerates zero-weight buckets', () => {
    const parts = allocate(cents(100), [1, 0, 1]);
    expect(parts).toEqual([50, 0, 50]);
  });

  it('rejects weights that sum to zero', () => {
    expect(() => allocate(cents(100), [0, 0])).toThrow(MoneyError);
  });

  it('rejects an empty bucket list', () => {
    expect(() => allocate(cents(100), [])).toThrow(MoneyError);
  });
});

describe('formatMZN()', () => {
  it('formats the canonical example from the brief', () => {
    expect(formatMZN(cents(1250000))).toBe('12.500,00 MT');
  });

  it('formats amounts below one thousand', () => {
    expect(formatMZN(cents(50000))).toBe('500,00 MT');
    expect(formatMZN(cents(85000))).toBe('850,00 MT');
  });

  it('formats zero', () => {
    expect(formatMZN(cents(0))).toBe('0,00 MT');
  });

  it('formats sub-metical amounts', () => {
    expect(formatMZN(cents(5))).toBe('0,05 MT');
    expect(formatMZN(cents(50))).toBe('0,50 MT');
  });

  it('groups every three digits', () => {
    expect(formatMZN(cents(100000000))).toBe('1.000.000,00 MT');
    expect(formatMZN(cents(123456789))).toBe('1.234.567,89 MT');
  });

  it('formats negative amounts for refunds and deductions', () => {
    expect(formatMZN(cents(-15600))).toBe('-156,00 MT');
  });

  it('can omit the symbol for use in a column already headed MT', () => {
    expect(formatMZN(cents(1250000), { symbol: false })).toBe('12.500,00');
  });

  it('uses a non-breaking space so the amount never wraps from its symbol', () => {
    expect(formatMZN(cents(100))).toContain(' ');
    expect(formatMZN(cents(100))).not.toContain(' MT');
  });
});

describe('parseMZNToCents()', () => {
  it('parses pt-MZ formatted input', () => {
    expect(parseMZNToCents('12.500,00')).toBe(1250000);
    expect(parseMZNToCents('1250,50')).toBe(125050);
  });

  it('parses input with the symbol and stray spaces', () => {
    expect(parseMZNToCents('12.500,00 MT')).toBe(1250000);
    expect(parseMZNToCents(' 850,00MT ')).toBe(85000);
  });

  it('parses a bare integer', () => {
    expect(parseMZNToCents('1250')).toBe(125000);
  });

  it('reads a dot with three trailing digits as a thousands separator', () => {
    expect(parseMZNToCents('1.250')).toBe(125000);
  });

  it('reads a dot with one or two trailing digits as a decimal point', () => {
    expect(parseMZNToCents('1250.50')).toBe(125050);
    expect(parseMZNToCents('1250.5')).toBe(125050);
  });

  it('round-trips through formatMZN', () => {
    const original = cents(1250000);
    const parsed = parseMZNToCents(formatMZN(original));
    expect(parsed).toBe(original);
  });

  it('returns null for unusable input rather than throwing', () => {
    expect(parseMZNToCents('')).toBeNull();
    expect(parseMZNToCents('abc')).toBeNull();
    expect(parseMZNToCents('12,50,00')).toBeNull();
  });
});
