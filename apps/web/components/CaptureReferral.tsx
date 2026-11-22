'use client';
import { useEffect } from 'react';

// Dropped on the invite landing: stores the invite code in a cookie so the next
// sign-up on this device is attributed to the referrer. Renders nothing.
export function CaptureReferral({ code }: { code: string }) {
  useEffect(() => {
    const safe = code.replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
    if (!safe) return;
    try {
      // 30 days, lax; readable by the verify BFF (not httpOnly on purpose).
      document.cookie = `nhonga_ref=${safe}; path=/; max-age=${30 * 24 * 3600}; samesite=lax`;
    } catch {
      /* ignore */
    }
  }, [code]);
  return null;
}
