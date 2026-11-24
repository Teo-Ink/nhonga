'use client';
import { useRef } from 'react';

/**
 * One Idempotency-Key per intended payment (P2-11). The key stays the same
 * while the person repeats the same action (a second tap, a retry after a
 * dropped connection), so the API charges once. It changes when the action
 * changes (another amount, another package) or after it succeeded.
 */
export function useActionKey(): {
  headers: (body: string) => Record<string, string>;
  done: () => void;
} {
  const cur = useRef<{ body: string; key: string } | null>(null);
  return {
    headers: (body) => {
      if (!cur.current || cur.current.body !== body) {
        cur.current = { body, key: crypto.randomUUID() };
      }
      return { 'idempotency-key': cur.current.key };
    },
    done: () => {
      cur.current = null;
    },
  };
}
