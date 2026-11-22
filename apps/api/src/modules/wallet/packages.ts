// Wallet packages: what a seller pays and what lands in the wallet. Kept free of
// framework imports so checkout settlement and tests can use it directly.

export interface WalletPackage {
  id: string;
  name: string;
  /** What the buyer pays (demo — no live gateway), in cents of MT. */
  priceCents: number;
  /** Balance credited to the wallet, in cents (may exceed price = bonus). */
  balanceCents: number;
  /** Loyalty points credited. */
  points: number;
}

export const PACKAGES: readonly WalletPackage[] = [
  { id: 'basico', name: 'Pacote Básico', priceCents: 10000, balanceCents: 10000, points: 10 },
  { id: 'popular', name: 'Pacote Popular', priceCents: 50000, balanceCents: 55000, points: 60 },
  { id: 'pro', name: 'Pacote Pro', priceCents: 100000, balanceCents: 115000, points: 150 },
];

/** A package by id (checkout uses this to price and credit package purchases). */
export function packageById(id: string): WalletPackage | undefined {
  return PACKAGES.find((p) => p.id === id);
}
