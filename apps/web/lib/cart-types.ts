export interface CartItem {
  readonly productId: string;
  readonly slug: string;
  readonly title: string;
  readonly variantId: string;
  readonly variantLabel: string; // e.g. "Cor: Azul · Tamanho: M"
  readonly priceCents: number;
  readonly image?: string;
  readonly vendorId: string;
  readonly vendorName: string;
  qty: number;
}

export type CartAction =
  | { type: 'add'; item: CartItem }
  | { type: 'setQty'; variantId: string; qty: number }
  | { type: 'remove'; variantId: string }
  | { type: 'clear' }
  | { type: 'hydrate'; items: CartItem[] };
