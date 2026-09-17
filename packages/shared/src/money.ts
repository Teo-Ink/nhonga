/**
 * Money.
 *
 * Every monetary value in Nhonga is an integer number of **centavos**. There are no
 * floating-point amounts anywhere in the system, and there is exactly one formatter.
 *
 * Why a branded `number` rather than `bigint`: JSON cannot carry `bigint`, and every amount
 * crosses a JSON boundary between the API, the web app, and the mobile app. `Number.MAX_SAFE_INTEGER`
 * is 9,007,199,254,740,991 centavos — about 90 trillion meticais — so the headroom is not a
 * practical concern. Postgres stores these as BIGINT; the driver returns a string, and
 * `centsFromDb` is the single guarded parse.
 *
 * See DECISIONS.md D-06 and D-24.
 */

declare const CentsBrand: unique symbol;

/** An integer number of centavos. 1 MT = 100 Cents. */
export type Cents = number & { readonly [CentsBrand]: 'Cents' };

export const ZERO = 0 as Cents;

/** The largest amount we accept anywhere. Roughly 10 billion MT — far above any real order,
 *  low enough that overflow in intermediate arithmetic is impossible. */
export const MAX_CENTS = 1_000_000_000_000 as Cents;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/** Construct a Cents value, validating that it is a safe integer in range. */
export function cents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new MoneyError(`Amount must be a whole number of centavos, received ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`Amount is outside the safe integer range: ${value}`);
  }
  if (Math.abs(value) > MAX_CENTS) {
    throw new MoneyError(`Amount exceeds the maximum permitted value: ${value}`);
  }
  return value as Cents;
}

/** Parse a BIGINT column value returned by the database driver as a string. */
export function centsFromDb(value: string | number | null | undefined): Cents {
  if (value === null || value === undefined) return ZERO;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(parsed)) {
    throw new MoneyError(`Could not parse a monetary value from the database: ${String(value)}`);
  }
  return cents(parsed);
}

/** Convert whole meticais to centavos. `fromMeticais(1250)` → 125000. */
export function fromMeticais(meticais: number): Cents {
  return cents(Math.round(meticais * 100));
}

export function add(...amounts: readonly Cents[]): Cents {
  let total = 0;
  for (const amount of amounts) total += amount;
  return cents(total);
}

export function subtract(minuend: Cents, subtrahend: Cents): Cents {
  return cents(minuend - subtrahend);
}

/** Multiply an amount by a whole quantity. Quantities are always integers — there is no
 *  fractional-quantity product in this catalogue. */
export function multiply(amount: Cents, quantity: number): Cents {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new MoneyError(`Quantity must be a non-negative whole number, received ${quantity}`);
  }
  return cents(amount * quantity);
}

export function isZero(amount: Cents): boolean {
  return amount === 0;
}

export function isNegative(amount: Cents): boolean {
  return amount < 0;
}

export function max(a: Cents, b: Cents): Cents {
  return a >= b ? a : b;
}

export function min(a: Cents, b: Cents): Cents {
  return a <= b ? a : b;
}

/**
 * Apply a rate expressed in **basis points** (1 bps = 0.01%).
 *
 * Commission and fee rates are stored as integer basis points precisely so that no
 * floating-point percentage can ever enter a fee calculation (D-17). 8.25% is `825`.
 *
 * Rounds half away from zero, which is the rule a person doing this by hand would use and
 * therefore the rule a vendor checking our arithmetic expects.
 */
export function applyBasisPoints(amount: Cents, bps: number): Cents {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new MoneyError(`Basis points must be a whole number between 0 and 10000, received ${bps}`);
  }
  const exact = (amount * bps) / 10_000;
  const rounded = exact < 0 ? -Math.round(-exact) : Math.round(exact);
  return cents(rounded);
}

/**
 * Split an amount across weighted buckets so the parts sum to **exactly** the total.
 *
 * Largest-remainder method. This exists because the naive approach — rounding each share
 * independently — produces a total that is one or two centavos off, and "off by a centavo"
 * in a settlement report is the kind of thing that costs an afternoon and a vendor's trust.
 *
 * Leftover centavos go to the buckets with the largest fractional remainder, ties broken by
 * position, so the result is deterministic and reproducible across web, mobile, and server.
 */
export function allocate(total: Cents, weights: readonly number[]): Cents[] {
  if (weights.length === 0) {
    throw new MoneyError('Cannot allocate across zero buckets');
  }
  if (total < 0) {
    throw new MoneyError('allocate() expects a non-negative total');
  }

  let weightSum = 0;
  for (const weight of weights) {
    if (!Number.isFinite(weight) || weight < 0) {
      throw new MoneyError(`Allocation weights must be non-negative finite numbers, received ${weight}`);
    }
    weightSum += weight;
  }
  if (weightSum <= 0) {
    throw new MoneyError('Allocation weights must sum to more than zero');
  }

  const floors: number[] = [];
  const remainders: Array<{ index: number; fraction: number }> = [];
  let allocated = 0;

  for (let i = 0; i < weights.length; i += 1) {
    const weight = weights[i] ?? 0;
    const exact = (total * weight) / weightSum;
    const floor = Math.floor(exact);
    floors.push(floor);
    remainders.push({ index: i, fraction: exact - floor });
    allocated += floor;
  }

  let leftover = total - allocated;
  remainders.sort((a, b) => (b.fraction - a.fraction) || (a.index - b.index));

  for (const entry of remainders) {
    if (leftover <= 0) break;
    floors[entry.index] = (floors[entry.index] ?? 0) + 1;
    leftover -= 1;
  }

  return floors.map((value) => cents(value));
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

/** Non-breaking space, so an amount never wraps away from its symbol. */
const NBSP = ' ';

function groupThousands(digits: string): string {
  let out = '';
  let counter = 0;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    out = `${digits[i] ?? ''}${out}`;
    counter += 1;
    if (counter === 3 && i > 0) {
      out = `.${out}`;
      counter = 0;
    }
  }
  return out;
}

export interface FormatOptions {
  /** Append the `MT` symbol. Default true. Set false inside a column already headed "MT". */
  symbol?: boolean;
}

/**
 * Format centavos as Mozambican Metical: `12.500,00 MT`.
 *
 * Deliberately does not use `Intl.NumberFormat`. Its output for MZN varies across ICU versions,
 * Node builds, Android WebViews, and Hermes — some emit `MTn`, some `MZN`, some lead rather than
 * trail. On a marketplace, a price that renders differently on web and mobile damages trust
 * directly, so there is one implementation and one snapshot test. See D-06.
 */
export function formatMZN(amount: Cents, options: FormatOptions = {}): string {
  const showSymbol = options.symbol ?? true;
  const negative = amount < 0;
  const absolute = Math.abs(amount);
  const major = Math.trunc(absolute / 100);
  const minor = absolute % 100;

  const body = `${groupThousands(String(major))},${String(minor).padStart(2, '0')}`;
  const signed = negative ? `-${body}` : body;

  return showSymbol ? `${signed}${NBSP}MT` : signed;
}

/**
 * Parse a price a vendor typed into centavos.
 *
 * Accepts `1.250,00`, `1250,00`, `1250.00`, `1250`, and any of those with a `MT` suffix or
 * stray spaces. Returns null rather than throwing, because this runs against live keystrokes.
 *
 * The ambiguous case is a bare dot. `1.250` could be "one thousand two hundred fifty" (pt-MZ
 * thousands separator) or "one point two five" (a vendor with an English keyboard habit). We
 * resolve it by digit count: exactly one or two digits after a single dot means a decimal,
 * three means a thousands separator. This is the reading that matches how people actually type
 * prices, and the vendor sees the parsed result formatted back to them before saving.
 */
export function parseMZNToCents(input: string): Cents | null {
  const cleaned = input
    .replace(/MT/gi, '')
    .replace(/\s/g, '')
    .trim();

  if (cleaned === '' || !/^-?[\d.,]+$/.test(cleaned)) return null;

  const negative = cleaned.startsWith('-');
  const digitsOnly = negative ? cleaned.slice(1) : cleaned;

  let normalised: string;

  if (digitsOnly.includes(',')) {
    // Comma present: it is the decimal separator, dots are thousands separators.
    if ((digitsOnly.match(/,/g) ?? []).length > 1) return null;
    normalised = digitsOnly.replace(/\./g, '').replace(',', '.');
  } else {
    const dotCount = (digitsOnly.match(/\./g) ?? []).length;
    if (dotCount === 0) {
      normalised = digitsOnly;
    } else if (dotCount === 1) {
      const afterDot = digitsOnly.split('.')[1] ?? '';
      // 1 or 2 trailing digits → decimal. 3 → thousands separator.
      normalised = afterDot.length === 3 ? digitsOnly.replace('.', '') : digitsOnly;
    } else {
      // Multiple dots can only be thousands separators.
      normalised = digitsOnly.replace(/\./g, '');
    }
  }

  const value = Number(normalised);
  if (!Number.isFinite(value)) return null;

  const asCents = Math.round(value * 100);
  if (!Number.isSafeInteger(asCents) || Math.abs(asCents) > MAX_CENTS) return null;

  return cents(negative ? -asCents : asCents);
}
