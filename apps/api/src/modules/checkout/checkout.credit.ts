import { packageById } from '../wallet/packages.js';

/** What a paid intent puts in the wallet, by purpose. */
export function creditFor(i: {
  purpose: string;
  amountCents: number;
  method: string;
  payload: unknown;
}): {
  kind: 'topup' | 'purchase';
  balanceCents: number;
  points: number;
  description: string;
} | null {
  const via = methodLabel(i.method);
  if (i.purpose === 'wallet_topup') {
    return {
      kind: 'topup',
      balanceCents: Number(i.amountCents),
      points: 0,
      description: `Carregamento ${via}`,
    };
  }
  if (i.purpose === 'wallet_package') {
    const pkg = packageById(String((i.payload as { packageId?: unknown }).packageId ?? ''));
    // The price was fixed when the intent was created; the package's balance
    // (with bonus) and points are what the seller bought.
    if (!pkg) return null;
    return {
      kind: 'purchase',
      balanceCents: pkg.balanceCents,
      points: pkg.points,
      description: `${pkg.name} (${via})`,
    };
  }
  return null;
}

export function methodLabel(m: string): string {
  return { mpesa: 'M-Pesa', emola: 'e-Mola', card: 'cartão' }[m] ?? m;
}
