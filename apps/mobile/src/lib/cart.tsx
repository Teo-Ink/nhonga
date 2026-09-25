import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface CartLine {
  variantId: string;
  productSlug: string;
  title: string;
  optionsLabel: string;
  unitPriceCents: number;
  imageUrl: string | null;
  quantity: number;
}

interface CartCtx {
  lines: CartLine[];
  count: number;
  totalCents: number;
  add: (line: Omit<CartLine, 'quantity'>, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
}

const Ctx = createContext<CartCtx | null>(null);

// In-memory guest cart (resets on app restart — a demo store). Keyed by variant.
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const add = useCallback((line: Omit<CartLine, 'quantity'>, qty = 1) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.variantId === line.variantId);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + qty };
        return next;
      }
      return [...prev, { ...line, quantity: qty }];
    });
  }, []);

  const setQty = useCallback((variantId: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.variantId !== variantId)
        : prev.map((l) => (l.variantId === variantId ? { ...l, quantity: qty } : l)),
    );
  }, []);

  const remove = useCallback((variantId: string) => {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartCtx>(() => {
    const count = lines.reduce((s, l) => s + l.quantity, 0);
    const totalCents = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
    return { lines, count, totalCents, add, setQty, remove, clear };
  }, [lines, add, setQty, remove, clear]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart must be used within CartProvider');
  return c;
}
