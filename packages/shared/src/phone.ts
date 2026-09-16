/**
 * Mozambican mobile numbers.
 *
 * The phone number is the account identifier (D-04) *and* the wallet identifier — a buyer's
 * MSISDN is their M-Pesa or e-Mola account. That coincidence is why the network prefix can
 * pre-select the payment rail at checkout (D-05), removing a decision from the screen with the
 * highest drop-off in the funnel.
 *
 * All numbers are stored E.164 (`+258841234567`) and displayed nationally (`84 123 4567`).
 */

export const MZ_DIALLING_CODE = '258';

export type MzOperator = 'vodacom' | 'movitel' | 'tmcel';

/** The wallet rails we can route a payment to. `cod` is deliberately a provider too — see D-22. */
export type WalletProvider = 'mpesa' | 'emola' | 'mkesh';

/**
 * Mozambican mobile prefixes, after the 258 country code.
 *
 * 82 / 83  Tmcel (formerly mCel)   → mKesh
 * 84 / 85  Vodacom                 → M-Pesa
 * 86 / 87  Movitel                 → e-Mola
 */
const OPERATOR_BY_PREFIX: Readonly<Record<string, MzOperator>> = Object.freeze({
  '82': 'tmcel',
  '83': 'tmcel',
  '84': 'vodacom',
  '85': 'vodacom',
  '86': 'movitel',
  '87': 'movitel',
});

const WALLET_BY_OPERATOR: Readonly<Record<MzOperator, WalletProvider>> = Object.freeze({
  vodacom: 'mpesa',
  movitel: 'emola',
  tmcel: 'mkesh',
});

/** National significant number: 9 digits, always beginning with 8. */
const NSN_PATTERN = /^8[2-7]\d{7}$/;

/**
 * Normalise anything a user might type into E.164, or return null.
 *
 * Accepts `841234567`, `84 123 4567`, `+258 84 123 4567`, `00258841234567`, and
 * `258841234567`. Rejects landlines, short codes, and numbers on prefixes no operator uses.
 */
export function normaliseMzMsisdn(input: string): string | null {
  if (typeof input !== 'string') return null;

  const digits = input.replace(/[^\d]/g, '');
  if (digits === '') return null;

  let nsn: string;

  if (digits.startsWith('00258')) {
    nsn = digits.slice(5);
  } else if (digits.startsWith(MZ_DIALLING_CODE) && digits.length === 12) {
    nsn = digits.slice(3);
  } else if (digits.length === 9) {
    nsn = digits;
  } else {
    return null;
  }

  if (!NSN_PATTERN.test(nsn)) return null;
  if (OPERATOR_BY_PREFIX[nsn.slice(0, 2)] === undefined) return null;

  return `+${MZ_DIALLING_CODE}${nsn}`;
}

export function isValidMzMsisdn(input: string): boolean {
  return normaliseMzMsisdn(input) !== null;
}

/** Extract the national significant number from a value already in E.164. */
function nsnOf(e164: string): string | null {
  const normalised = normaliseMzMsisdn(e164);
  return normalised === null ? null : normalised.slice(4);
}

export function operatorOf(msisdn: string): MzOperator | null {
  const nsn = nsnOf(msisdn);
  if (nsn === null) return null;
  return OPERATOR_BY_PREFIX[nsn.slice(0, 2)] ?? null;
}

/**
 * The wallet we pre-select at checkout for this number.
 *
 * A pre-selection, never a constraint. Plenty of people carry two SIMs, or pay from a spouse's
 * wallet, so the buyer can always override — which costs nothing when we guess wrong and saves
 * a tap when we guess right.
 */
export function suggestedWalletFor(msisdn: string): WalletProvider | null {
  const operator = operatorOf(msisdn);
  return operator === null ? null : WALLET_BY_OPERATOR[operator];
}

/** Human-readable operator name, for the inline hint on the phone field. */
export function operatorLabel(operator: MzOperator): string {
  switch (operator) {
    case 'vodacom':
      return 'Vodacom';
    case 'movitel':
      return 'Movitel';
    case 'tmcel':
      return 'Tmcel';
  }
}

/** Display format: `84 123 4567`. */
export function formatNational(msisdn: string): string | null {
  const nsn = nsnOf(msisdn);
  if (nsn === null) return null;
  return `${nsn.slice(0, 2)} ${nsn.slice(2, 5)} ${nsn.slice(5)}`;
}

/** Display format with the code: `+258 84 123 4567`. */
export function formatInternational(msisdn: string): string | null {
  const national = formatNational(msisdn);
  return national === null ? null : `+${MZ_DIALLING_CODE} ${national}`;
}

/**
 * Masked for display in receipts, order detail, and support tooling: `84 *** 4567`.
 *
 * Keeps the prefix (so the buyer recognises which wallet paid) and the last four (so they can
 * match it against their own records) while not printing a full contactable number onto a
 * screen someone else might be looking at.
 */
export function maskMsisdn(msisdn: string): string | null {
  const nsn = nsnOf(msisdn);
  if (nsn === null) return null;
  return `${nsn.slice(0, 2)} *** ${nsn.slice(5)}`;
}

/**
 * Progressive formatting for a phone field as the user types.
 *
 * Takes raw keystrokes and returns what should appear in the input. Minimal text entry matters
 * a great deal here — this field sits directly in the first-purchase funnel.
 */
export function formatAsTyped(input: string): string {
  const digits = input.replace(/[^\d]/g, '').slice(0, 9);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
}
