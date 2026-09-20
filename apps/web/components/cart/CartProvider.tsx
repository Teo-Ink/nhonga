'use client';
import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type { CartAction, CartItem } from '../../lib/cart-types';

const KEY = 'nhonga_cart_v1';

function reducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'hydrate':
      return action.items;
    case 'add': {
      const existing = state.find((i) => i.variantId === action.item.variantId);
      if (existing) {
        return state.map((i) =>
          i.variantId === action.item.variantId ? { ...i, qty: i.qty + action.item.qty } : i,
        );
      }
      return [...state, action.item];
    }
    case 'setQty':
      return state
        .map((i) => (i.variantId === action.variantId ? { ...i, qty: Math.max(0, action.qty) } : i))
        .filter((i) => i.qty > 0);
    case 'remove':
      return state.filter((i) => i.variantId !== action.variantId);
    case 'clear':
      return [];
    default:
      return state;
  }
}

interface CartCtx {
  items: CartItem[];
  count: number;
  totalCents: number;
  add: (item: CartItem) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
}

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(reducer, []);

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) dispatch({ type: 'hydrate', items: JSON.parse(raw) as CartItem[] });
    } catch {
      /* private mode / corrupt */
    }
  }, []);

  // Persist on change.
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const count = items.reduce((n, i) => n + i.qty, 0);
  const totalCents = items.reduce((n, i) => n + i.priceCents * i.qty, 0);

  const value: CartCtx = {
    items,
    count,
    totalCents,
    add: (item) => dispatch({ type: 'add', item }),
    setQty: (variantId, qty) => dispatch({ type: 'setQty', variantId, qty }),
    remove: (variantId) => dispatch({ type: 'remove', variantId }),
    clear: () => dispatch({ type: 'clear' }),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart must be used within CartProvider');
  return c;
}
