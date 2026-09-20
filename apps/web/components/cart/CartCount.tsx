'use client';
import { useCart } from './CartProvider';

// Live cart badge in the header.
export function CartCount() {
  const { count } = useCart();
  if (count === 0) return null;
  return (
    <span className="badge-count" aria-label={`${count}`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
